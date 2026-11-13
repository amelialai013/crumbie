import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { isDateClosed } from "@/lib/catalog";
import { getCardOption, getProducts, getPickupDates } from "@/lib/catalog-store";
import { setRecord } from "@/lib/store";

const lineSchema = z.object({
	productId: z.string(),
	variantId: z.string(),
	quantity: z.number().int().min(1).max(99),
	pickupDateId: z.string(),
	cardMessages: z.array(z.string().max(140)).max(99).optional(),
});
const schema = z.object({ lines: z.array(lineSchema).min(1).max(30) });

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
	const [products, pickupDates, cardOption] = await Promise.all([getProducts(), getPickupDates(), getCardOption()]);
	const parsed = schema.safeParse(await req.json().catch(() => null));
	if (!parsed.success) return NextResponse.json({ error: "Your cart is invalid." }, { status: 400 });

	// Price comes from settings, never from the client; a card requested after it was disabled is dropped.
	const clean = [];
	const cardMessages: string[] = [];
	const cardProducts: string[] = [];
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
			for (const message of (line.cardMessages ?? []).slice(0, line.quantity)) {
				cardMessages.push(message.trim());
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
	const card = cardMessages.length > 0 ? { label: cardOption.label, price: cardOption.price, quantity: cardMessages.length, messages: cardMessages, products: cardProducts } : null;

	if (!process.env.STRIPE_SECRET_KEY) {
		return NextResponse.json({ error: "Online checkout is temporarily unavailable. Please try again later." }, { status: 503 });
	}
	const tax = getTaxConfig();
	if (!tax) {
		return NextResponse.json({ error: "Online checkout tax settings are incomplete." }, { status: 503 });
	}

	const pendingId = crypto.randomUUID();
	try {
		await setRecord("pending-checkout", pendingId, { id: pendingId, lines: clean, card, createdAt: new Date().toISOString() });
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
		const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
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
			payment_intent_data: { metadata: { pendingId } },
		}, { idempotencyKey: pendingId });

		if (!session.url) throw new Error("Stripe Checkout URL missing");
		return NextResponse.json({ url: session.url });
	} catch {
		return NextResponse.json({ error: "Online checkout is temporarily unavailable. Please try again later." }, { status: 503 });
	}
}
