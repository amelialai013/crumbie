import { NextResponse } from "next/server";
import { z } from "zod";
import { getDeliveryDates, getPickupDates, getProducts } from "@/lib/catalog-store";
import { isAdmin } from "@/lib/session";
import { saveRecord } from "@/lib/store";

const schema = z.object({
	name: z.string().trim().min(1).max(120),
	email: z.string().trim().max(200).email().or(z.literal("")),
	phone: z.string().trim().max(40).optional().default(""),
	notes: z.string().trim().max(1000).optional().default(""),
	fulfilment: z.enum(["pickup", "delivery"]),
	lines: z
		.array(
			z.object({
				productId: z.string().min(1),
				variantId: z.string().min(1),
				quantity: z.number().int().min(1).max(100),
				pickupDateId: z.string().optional(),
			}),
		)
		.min(1)
		.max(30),
	delivery: z
		.object({
			name: z.string().trim().max(120).optional().default(""),
			street: z.string().trim().min(1).max(200),
			suburb: z.string().trim().min(1).max(100),
			postcode: z.string().trim().min(3).max(10),
		})
		.optional(),
	deliveryDateId: z.string().optional(),
	deliveryFee: z.number().min(0).max(1000).optional().default(0),
});

export async function POST(req: Request) {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const parsed = schema.safeParse(await req.json().catch(() => null));
	if (!parsed.success) return NextResponse.json({ error: "Check the order details and try again." }, { status: 400 });
	const input = parsed.data;

	const [products, pickupDates, deliveryDates] = await Promise.all([getProducts(), getPickupDates(), getDeliveryDates()]);

	let deliverySlot: { date: string; window: string } | null = null;
	if (input.fulfilment === "delivery") {
		if (!input.delivery) return NextResponse.json({ error: "Add a delivery address." }, { status: 400 });
		const slot = deliveryDates.find((item) => item.id === input.deliveryDateId);
		if (!slot) return NextResponse.json({ error: "Choose a delivery date." }, { status: 400 });
		deliverySlot = { date: slot.date, window: slot.window };
	}

	const lines = [];
	for (const line of input.lines) {
		const product = products.find((item) => item.id === line.productId);
		const variant = product?.variants.find((item) => item.id === line.variantId);
		if (!product || !variant) return NextResponse.json({ error: "One of the products is no longer available." }, { status: 400 });
		const base = {
			productId: product.id,
			productName: product.name,
			variantId: variant.id,
			variantLabel: variant.label,
			unitPrice: variant.price,
			quantity: line.quantity,
			status: "paid",
			readyNotifiedAt: null,
		};
		if (input.fulfilment === "delivery") {
			lines.push({ ...base, fulfilment: "delivery" as const, deliverySlot });
			continue;
		}
		const pickup = pickupDates.find((item) => item.id === line.pickupDateId);
		if (!pickup) return NextResponse.json({ error: `Choose a pickup date for ${product.name}.` }, { status: 400 });
		lines.push({ ...base, fulfilment: "pickup" as const, pickupDateId: pickup.id, pickupDate: pickup.date, pickupWindow: pickup.window });
	}

	const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
	const deliveryFee = input.fulfilment === "delivery" ? input.deliveryFee : 0;
	const order = {
		id: crypto.randomUUID(),
		manual: true,
		notes: input.notes,
		customer: { name: input.name, email: input.email, phone: input.phone },
		lines,
		card: null,
		fulfilment: input.fulfilment,
		delivery: input.fulfilment === "delivery" && input.delivery ? { ...input.delivery, name: input.delivery.name || input.name, source: "manual" as const } : null,
		deliveryFee,
		deliverySlot,
		paymentStatus: "manual",
		currency: "aud",
		amountTotal: Math.round((subtotal + deliveryFee) * 100),
		amountTax: 0,
		automaticTaxStatus: null,
		createdAt: new Date().toISOString(),
	};

	try {
		await saveRecord("order", order);
	} catch {
		return NextResponse.json({ error: "Unable to save the order." }, { status: 503 });
	}
	return NextResponse.json(order, { status: 201 });
}
