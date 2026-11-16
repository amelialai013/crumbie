import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { isDateClosed } from "@/lib/catalog";
import { deliveryFeeFor, postcodeAllowed } from "@/lib/delivery";
import { getCardOption, getDelivery, getProducts, getPickupDates, getPromo } from "@/lib/catalog-store";
import { setRecord } from "@/lib/store";

const lineSchema = z.object({
	productId: z.string(),
	variantId: z.string(),
	quantity: z.number().int().min(1).max(99),
	pickupDateId: z.string(),
	cardMessages: z.array(z.string().max(300)).max(99).optional(),
	cardNames: z.array(z.string().max(60)).max(99).optional(),
});
const deliverySchema = z.object({
	name: z.string().trim().min(1).max(80),
	street: z.string().trim().min(1).max(120),
	suburb: z.string().trim().min(1).max(60),
	postcode: z.string().trim(),
});
const schema = z.object({
	lines: z.array(lineSchema).min(1).max(30),
	fulfilment: z.enum(["pickup", "delivery"]).optional(),
	delivery: deliverySchema.optional(),
});

type TaxConfig =
	| { enabled: false }
	| { enabled: true; productTaxCode: string; taxBehavior: "inclusive" | "exclusive" };

function getTaxConfig(): TaxConfig | null {
	if (process.env.STRIPE_AUTOMATIC_TAX_ENABLED !== "true") return { enabled: false };

	const productTaxCode = process.env.STRIPE_PRODUCT_TAX_CODE?.trim();
	const taxBehavior = process.env.STRIPE_TAX_BEHAVIOR;
	if (!productTaxCode?.match(/^txcd_\d+$/) || (taxBehavior !== "inclusive" && taxBehavior !== "exclusive")) return null;

	return { enabled: true, productTaxCode, taxBehavior };
}

const integrationIdentifier = (() => {
	const suffix = Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => String.fromCharCode(97 + (byte % 26))).join("");
	return `clubcrumbie_${suffix}`;
})();

export async function POST(req: Request) {
	const [products, pickupDates, cardOption, promo, deliveryOption] = await Promise.all([getProducts(), getPickupDates(), getCardOption(), getPromo(), getDelivery()]);
	const parsed = schema.safeParse(await req.json().catch(() => null));
	if (!parsed.success) return NextResponse.json({ error: "Your cart is invalid." }, { status: 400 });

	// Price comes from settings, never from the client; a card requested after it was disabled is dropped.
	const clean = [];
	const cardMessages: string[] = [];
	const cardNames: string[] = [];
	const cardProducts: string[] = [];
	const cardProductIds = new Set<string>();
	for (const line of parsed.data.lines) {
		const product = products.find((item) => item.id === line.productId);
		const variant = product?.variants.find((item) => item.id === line.variantId);
		const pickup = pickupDates.find((item) => item.id === line.pickupDateId);

		if (!product || !variant || !pickup || product.soldOut || product.soldOutDates?.includes(pickup.id) || isDateClosed(pickup)) {
			const error = !product || !variant || product.soldOut
        ? "This product or box size is no longer available. Please remove it and choose another box."
        : !pickup || product.soldOutDates?.includes(pickup.id) || pickup.soldOut
          ? `${product.name}: this pickup is no longer available. Please remove it and choose another pickup date.`
          : `${product.name}: orders for ${pickup.date} (${pickup.window}) have closed. Orders close 72 hours before pickup. Please remove this item and choose an available pickup date.`;
      return NextResponse.json({ error }, { status: 409 });
		}

		if (cardOption.enabled) {
			const lineMessages = (line.cardMessages ?? []).slice(0, line.quantity);
			for (const [index, message] of lineMessages.entries()) {
				const name = (line.cardNames?.[index] ?? "").trim();
				if (!name) {
					return NextResponse.json({ error: `${product.name}: please add a name for each Club Crumbie Card.` }, { status: 400 });
				}
				cardNames.push(name);
				cardMessages.push(message.trim());
				cardProductIds.add(product.id);
				cardProducts.push(`${product.name} — ${variant.label}`);
			}
		}

		clean.push({
			productId: product.id,
			productName: product.name,
			variantId: variant.id,
			variantLabel: variant.label,
			unitPrice: variant.price,
			quantity: line.quantity,
			pickupDateId: pickup.id,
			pickupDate: pickup.date,
			pickupWindow: pickup.window,
		});
	}

	// Each line's cards are capped at its own box count, so a stale cart can't buy more cards than boxes.
	const card = cardMessages.length > 0 ? { label: promo?.cardLabel && cardProductIds.size === 1 && cardProductIds.has(promo.productId) ? promo.cardLabel : cardOption.label, price: cardOption.price, quantity: cardMessages.length, names: cardNames, messages: cardMessages, products: cardProducts } : null;

	// Delivery is validated server-side; when switched off in admin every order is pickup.
	const fulfilment = deliveryOption.enabled && parsed.data.fulfilment === "delivery" ? "delivery" : "pickup";
	let delivery: { name: string; street: string; suburb: string; postcode: string } | null = null;
	let deliveryFee = 0;
	if (fulfilment === "delivery") {
		if (!parsed.data.delivery) return NextResponse.json({ error: "Please enter your delivery address." }, { status: 400 });
		delivery = parsed.data.delivery;
		if (!postcodeAllowed(delivery.postcode, deliveryOption.postcodes)) {
			return NextResponse.json({ error: "Sorry, we don't deliver to that postcode. Choose pickup or try another address." }, { status: 400 });
		}
		const subtotal = clean.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0) + (card ? card.price * card.quantity : 0);
		deliveryFee = deliveryFeeFor(deliveryOption, subtotal);
	}

	if (!process.env.STRIPE_SECRET_KEY) {
		return NextResponse.json({ error: "Online checkout is temporarily unavailable. Please try again later." }, { status: 503 });
	}
	const tax = getTaxConfig();
	if (!tax) {
		return NextResponse.json({ error: "Online checkout tax settings are incomplete." }, { status: 503 });
	}

	const pendingId = crypto.randomUUID();
	try {
		await setRecord("pending-checkout", pendingId, { id: pendingId, lines: clean, card, fulfilment, delivery, deliveryFee, createdAt: new Date().toISOString() });
		const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
		const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = clean.map((line) => ({
			quantity: line.quantity,
			price_data: {
				currency: "aud",
				unit_amount: Math.round(line.unitPrice * 100),
				tax_behavior: tax.enabled ? tax.taxBehavior : undefined,
				product_data: {
					name: `${line.productName} — ${line.variantLabel}`,
					description: `Pickup ${line.pickupDate}, ${line.pickupWindow}`,
					tax_code: tax.enabled ? tax.productTaxCode : undefined,
				},
			},
		}));
		if (card && card.price > 0) {
			lineItems.push({
				quantity: card.quantity,
				price_data: {
					currency: "aud",
					unit_amount: Math.round(card.price * 100),
					tax_behavior: tax.enabled ? tax.taxBehavior : undefined,
					product_data: { name: card.label, tax_code: tax.enabled ? tax.productTaxCode : undefined },
				},
			});
		}
		if (delivery && deliveryFee > 0) {
			lineItems.push({
				quantity: 1,
				price_data: {
					currency: "aud",
					unit_amount: Math.round(deliveryFee * 100),
					tax_behavior: tax.enabled ? tax.taxBehavior : undefined,
					product_data: { name: "Delivery", tax_code: tax.enabled ? tax.productTaxCode : undefined },
				},
			});
		}
		// Return to the origin the customer is on; the cart lives in that origin's localStorage.
		const origin = new URL(req.url).origin;
		const session = await stripe.checkout.sessions.create({
			mode: "payment",
			currency: "aud",
			integration_identifier: integrationIdentifier,
			automatic_tax: { enabled: tax.enabled },
			line_items: lineItems,
			customer_creation: "always",
			phone_number_collection: { enabled: true },
			success_url: `${origin}/order-success?session_id={CHECKOUT_SESSION_ID}`,
			cancel_url: `${origin}${delivery ? "/checkout" : "/cart"}`,
			metadata: { pendingId },
			payment_intent_data: {
				metadata: { pendingId },
				...(delivery ? { shipping: { name: delivery.name, address: { line1: delivery.street, city: delivery.suburb, state: "VIC", postal_code: delivery.postcode, country: "AU" } } } : {}),
			},
		}, { idempotencyKey: pendingId });

		if (!session.url) throw new Error("Stripe Checkout URL missing");
		return NextResponse.json({ url: session.url });
	} catch {
		return NextResponse.json({ error: "Online checkout is temporarily unavailable. Please try again later." }, { status: 503 });
	}
}
