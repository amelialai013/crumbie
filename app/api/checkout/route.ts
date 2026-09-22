import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { isDateClosed, pickupDates } from "@/lib/catalog";
import { getProducts } from "@/lib/catalog-store";
import { setRecord } from "@/lib/store";

const lineSchema = z.object({
	productId: z.string(),
	variantId: z.string(),
	quantity: z.number().int().min(1).max(99),
	pickupDateId: z.string(),
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
	const products = await getProducts();
	const parsed = schema.safeParse(await req.json().catch(() => null));
	if (!parsed.success) return NextResponse.json({ error: "Your cart is invalid." }, { status: 400 });

	const clean = [];
	for (const line of parsed.data.lines) {
		const product = products.find((item) => item.id === line.productId);
		const variant = product?.variants.find((item) => item.id === line.variantId);
		const pickup = pickupDates.find((item) => item.id === line.pickupDateId);

		if (!product || !variant || !pickup || product.soldOut || product.soldOutDates?.includes(pickup.id) || isDateClosed(pickup)) {
			return NextResponse.json({ error: "An item or pickup date is no longer available." }, { status: 409 });
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

	if (!process.env.STRIPE_SECRET_KEY) {
		return NextResponse.json({ error: "Online checkout is temporarily unavailable. Please try again later." }, { status: 503 });
	}
	const tax = getTaxConfig();
	if (!tax) {
		return NextResponse.json({ error: "Online checkout tax settings are incomplete." }, { status: 503 });
	}

	const pendingId = crypto.randomUUID();
	try {
		await setRecord("pending-checkout", pendingId, { id: pendingId, lines: clean, createdAt: new Date().toISOString() });
		const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
		const origin = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
		const session = await stripe.checkout.sessions.create({
			mode: "payment",
			currency: "aud",
			integration_identifier: integrationIdentifier,
			automatic_tax: { enabled: tax.enabled },
			line_items: clean.map((line) => ({
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
			})),
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
