import { NextResponse } from "next/server";
import Stripe from "stripe";
import { sendOrderConfirmation } from "@/lib/email";
import { getRecord, saveRecord, setRecord } from "@/lib/store";

type Pending = { id: string; lines: Array<Record<string, unknown>>; createdAt: string };

export async function POST(req: Request) {
	if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
		return new NextResponse("Not configured", { status: 503 });
	}

	const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
	let event: Stripe.Event;
	try {
		event = stripe.webhooks.constructEvent(
			await req.text(),
			req.headers.get("stripe-signature") || "",
			process.env.STRIPE_WEBHOOK_SECRET,
		);
	} catch {
		return new NextResponse("Invalid signature", { status: 400 });
	}

	if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
		const session = event.data.object;
		if (session.payment_status === "unpaid") return NextResponse.json({ received: true });

		const pendingId = session.metadata?.pendingId;
		if (pendingId) {
			const existing = await getRecord("stripe-event", event.id);
			if (!existing) {
				const pending = await getRecord<Pending>("pending-checkout", pendingId);
				if (pending) {
					const order = {
						id: crypto.randomUUID(),
						stripeSessionId: session.id,
						stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
						customer: {
							name: session.customer_details?.name || "",
							email: session.customer_details?.email || "",
							phone: session.customer_details?.phone || "",
						},
						lines: pending.lines.map((line) => ({ ...line, status: "paid", readyNotifiedAt: null })),
						paymentStatus: session.payment_status,
						currency: session.currency,
						amountTotal: session.amount_total,
						amountTax: session.total_details?.amount_tax ?? 0,
						automaticTaxStatus: session.automatic_tax?.status ?? null,
						createdAt: new Date().toISOString(),
					};
					await saveRecord("order", order);
					await setRecord("stripe-event", event.id, { id: event.id, processedAt: new Date().toISOString() });
					try {
						await sendOrderConfirmation(order);
					} catch (error) {
						console.error("Unable to send order confirmation", error);
					}
				}
			}
		}
	}

	if (event.type === "checkout.session.async_payment_failed") {
		await setRecord("stripe-event", event.id, {
			id: event.id,
			stripeSessionId: event.data.object.id,
			outcome: "payment_failed",
			processedAt: new Date().toISOString(),
		});
	}

	return NextResponse.json({ received: true });
}
