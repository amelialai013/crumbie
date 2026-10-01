import { NextResponse } from "next/server";
import { z } from "zod";
import { sendEnquiryReply } from "@/lib/email";
import { isAdmin } from "@/lib/session";
import { getRecord, setRecord } from "@/lib/store";

const schema = z.object({
	id: z.string().trim().min(1).max(100),
	subject: z.string().trim().min(1).max(200),
	message: z.string().trim().min(1).max(10000),
});

type EnquiryReply = { subject: string; message: string; sentAt: string };
type Enquiry = { id: string; email?: string; status?: string; replies?: EnquiryReply[]; repliedAt?: string; readAt?: string };

export async function POST(req: Request) {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	if (!process.env.RESEND_API_KEY?.trim()) {
		return NextResponse.json({ error: "Email sending is not configured. Add Resend to send replies." }, { status: 503 });
	}

	const parsed = schema.safeParse(await req.json().catch(() => null));
	if (!parsed.success) return NextResponse.json({ error: "Add a subject and message." }, { status: 400 });

	const { id, subject, message } = parsed.data;
	const enquiry = await getRecord<Enquiry>("custom-order", id);
	if (!enquiry) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
	if (!enquiry.email) return NextResponse.json({ error: "This enquiry has no email address." }, { status: 400 });

	try {
		await sendEnquiryReply({ to: enquiry.email, subject, message });
	} catch (error) {
		console.error("Enquiry reply failed", error);
		return NextResponse.json({ error: "Unable to send reply. Please try again." }, { status: 502 });
	}

	const sentAt = new Date().toISOString();
	const updated: Enquiry = {
		...enquiry,
		status: "replied",
		repliedAt: sentAt,
		readAt: enquiry.readAt || sentAt,
		replies: [...(enquiry.replies || []), { subject, message, sentAt }],
	};
	await setRecord("custom-order", id, updated);
	return NextResponse.json(updated);
}
