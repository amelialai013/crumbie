import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { isDateClosed } from "@/lib/catalog";
import { addressExists, addressShapeOk } from "@/lib/address";
import { deliveryFeeFor, postcodeAllowed } from "@/lib/delivery";
import { getCardOption, getDelivery, getProducts, getPickupDates, getPromo, getUnavailableMessage } from "@/lib/catalog-store";
import { setRecord } from "@/lib/store";

const lineSchema = z.object({
	productId: z.string(),
	variantId: z.string(),
	quantity: z.number().int().min(1).max(99),
	pickupDateId: z.string(),
	fulfilment: z.enum(["pickup", "delivery"]).optional(),
	deliverySlot: z.object({ date: z.string(), window: z.string() }).optional(),
	cardMessages: z.array(z.string().max(500)).max(99).optional(),
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
	deliverySlot: z.object({ date: z.string(), window: z.string() }).optional(),
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
	const [products, pickupDates, cardOption, promo, deliveryOption, unavailableMessage] = await Promise.all([getProducts(), getPickupDates(), getCardOption(), getPromo(), getDelivery(), getUnavailableMessage()]);
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
        ? unavailableMessage
        : !pickup || product.soldOutDates?.includes(pickup.id) || pickup.soldOut
          ? `${product.name}: this pickup is no longer available. Please remove it and choose another pickup window.`
          : `${product.name}: orders for ${pickup.date} (${pickup.window}) have closed. Orders close 72 hours before pickup. Please remove this item and choose an available pickup window.`;
      return NextResponse.json({ error }, { status: 409 });
		}

		if (cardOption.enabled) {
			const lineMessages = (line.cardMessages ?? []).slice(0, line.quantity);
			for (const [index, message] of lineMessages.entries()) {
				const name = (line.cardNames?.[index] ?? "").trim().slice(0, cardOption.nameMaxLength);
				if (!name) {
					return NextResponse.json({ error: `${product.name}: please add a name for each Club Crumbie Card.` }, { status: 400 });
				}
				cardNames.push(name);
				cardMessages.push(message.trim().slice(0, cardOption.messageMaxLength));
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
			fulfilment: (line.fulfilment ?? parsed.data.fulfilment) === "delivery" && deliveryOption.enabled ? ("delivery" as const) : ("pickup" as const),
			deliverySlot: line.deliverySlot ?? parsed.data.deliverySlot,
		});
	}

	// Each line's cards are capped at its own box count, so a stale cart can't buy more cards than boxes.
	const card = cardMessages.length > 0 ? { label: promo?.cardLabel && cardProductIds.size === 1 && cardProductIds.has(promo.productId) ? promo.cardLabel : cardOption.label, price: cardOption.price, quantity: cardMessages.length, names: cardNames, messages: cardMessages, products: cardProducts } : null;

	// Each line is either pickup or delivery; delivery lines are validated server-side and need an address.
	const deliveryLines = clean.filter((line) => line.fulfilment === "delivery");
	const hasPickup = clean.some((line) => line.fulfilment === "pickup");
	const fulfilment = deliveryLines.length > 0 ? "delivery" : "pickup";
	let delivery: { name: string; street: string; suburb: string; postcode: string } | null = null;
	let deliveryFee = 0;
	let deliverySlot: { date: string; window: string } | null = null;
	const openSlots = deliveryOption.slots.filter((slot) => !isDateClosed(slot));
	const lineSlots = new Map<(typeof clean)[number], { date: string; window: string } | null>();
	if (deliveryLines.length > 0) {
		if (!parsed.data.delivery) return NextResponse.json({ error: "Please enter your delivery address." }, { status: 400 });
		delivery = parsed.data.delivery;
		if (!postcodeAllowed(delivery.postcode, deliveryOption.postcodes)) {
			return NextResponse.json({ error: "Sorry, we don't deliver to that postcode. Choose pickup or try another address." }, { status: 400 });
		}
		if (!addressShapeOk(delivery.street, delivery.suburb) || !(await addressExists(delivery.street, delivery.suburb, delivery.postcode))) {
			return NextResponse.json({ error: deliveryOption.addressErrorMessage, field: "street" }, { status: 400 });
		}
		const deliverySubtotal = deliveryLines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0) + (card ? card.price * card.quantity : 0);
		deliveryFee = deliveryFeeFor(deliveryOption, deliverySubtotal);
		for (const line of deliveryLines) {
			const requested = line.deliverySlot;
			const chosen = requested ? openSlots.find((slot) => slot.date === requested.date && slot.window === requested.window) : openSlots[0];
			if (requested && !chosen) return NextResponse.json({ error: "That delivery window is no longer available. Please choose another." }, { status: 400 });
			lineSlots.set(line, chosen ? { date: chosen.date, window: chosen.window } : null);
		}
		deliverySlot = lineSlots.get(deliveryLines[0]) ?? null;
	}
	for (const line of clean) {
		line.deliverySlot = lineSlots.get(line) ?? undefined;
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
		await setRecord("pending-checkout", pendingId, { id: pendingId, lines: clean, card, fulfilment, delivery, deliveryFee, deliverySlot, createdAt: new Date().toISOString() });
		const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
		const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = clean.map((line) => ({
			quantity: line.quantity,
			price_data: {
				currency: "aud",
				unit_amount: Math.round(line.unitPrice * 100),
				tax_behavior: tax.enabled ? tax.taxBehavior : undefined,
				product_data: {
					name: `${line.productName} — ${line.variantLabel}`,
					description: line.fulfilment === "delivery" ? (line.deliverySlot ? `Delivery ${line.deliverySlot.date}, ${line.deliverySlot.window}` : "Delivery") : `Pickup ${line.pickupDate}, ${line.pickupWindow}`,
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
		if (hasPickup && deliveryOption.pickupFee > 0) {
			lineItems.push({
				quantity: 1,
				price_data: {
					currency: "aud",
					unit_amount: Math.round(deliveryOption.pickupFee * 100),
					tax_behavior: tax.enabled ? tax.taxBehavior : undefined,
					product_data: { name: "Pickup", tax_code: tax.enabled ? tax.productTaxCode : undefined },
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
			cancel_url: `${origin}/cart`,
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
