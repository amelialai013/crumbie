import { NextResponse } from "next/server";
import { z } from "zod";
import { newsletterClient, newsletterSegmentId, sendConfirmationEmail } from "@/lib/newsletter";

const schema = z.object({ email: z.string().trim().toLowerCase().email().max(200), website: z.string().optional() });

export async function POST(req: Request) {
	const parsed = schema.safeParse(await req.json().catch(() => null));
	if (!parsed.success) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
	// Honeypot: bots fill the hidden field, so pretend it worked.
	if (parsed.data.website) return NextResponse.json({ ok: true });

	try {
		const resend = newsletterClient();
		const { email } = parsed.data;
		const existing = await resend.contacts.get({ email });
		// Already confirmed: nothing to do (and nothing to reveal).
		if (existing.data && !existing.data.unsubscribed) return NextResponse.json({ ok: true });
		if (!existing.data) {
			const segmentId = await newsletterSegmentId(resend);
			const { error } = await resend.contacts.create({ email, unsubscribed: true, segments: [{ id: segmentId }] });
			if (error && !/already exists/i.test(error.message)) throw new Error(error.message);
		}
		await sendConfirmationEmail(resend, email);
	} catch (error) {
		console.error("Unable to subscribe", error);
		return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 502 });
	}
	return NextResponse.json({ ok: true }, { status: 201 });
}
