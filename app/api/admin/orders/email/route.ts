import { NextResponse } from "next/server";
import { z } from "zod";
import { sendOrderEmail } from "@/lib/email";
import { isAdmin } from "@/lib/session";
import { getRecord, setRecord } from "@/lib/store";

const schema = z.object({
	id: z.string().trim().min(1).max(100),
	subject: z.string().trim().min(1).max(200),
	message: z.string().trim().min(1).max(10000),
});

type SentEmail = { subject: string; message: string; sentAt: string };
type Order = { id: string; customer?: { email?: string }; emails?: SentEmail[] };

export async function POST(req: Request) {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const parsed = schema.safeParse(await req.json().catch(() => null));
	if (!parsed.success) return NextResponse.json({ error: "Add a subject and message." }, { status: 400 });

	const { id, message } = parsed.data;
	const subject = parsed.data.subject.replace(/[\r\n]+/g, " ");
	const order = await getRecord<Order>("order", id);
	if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
	if (!order.customer?.email) return NextResponse.json({ error: "This order has no email address." }, { status: 400 });

	try {
		await sendOrderEmail({ to: order.customer.email, subject, message });
	} catch (error) {
		console.error("Order email failed", error);
		return NextResponse.json({ error: "Unable to send email. Please try again." }, { status: 502 });
	}

	const updated = { ...order, emails: [...(order.emails ?? []), { subject, message, sentAt: new Date().toISOString() }] };
	await setRecord("order", id, updated);
	return NextResponse.json(updated);
}
