import { NextResponse } from "next/server";
import { z } from "zod";
import { newsletterClient, newsletterFrom, newsletterHtml, newsletterSegmentId } from "@/lib/newsletter";
import { notificationRecipients } from "@/lib/enquiry-mail";
import { isAdmin } from "@/lib/session";

const schema = z.object({
	mode: z.enum(["test", "send"]),
	subject: z.string().trim().min(1).max(200),
	body: z.string().trim().min(1).max(10000),
	buttonLabel: z.string().trim().max(60).optional(),
	buttonUrl: z.string().trim().url().max(500).optional().or(z.literal("")),
	images: z.array(z.object({ src: z.string().trim().url().max(500), after: z.number().int().min(-1).max(200) })).max(6).optional(),
	scheduledAt: z.string().datetime().optional().or(z.literal("")),
});

export async function GET() {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	try {
		const resend = newsletterClient();
		const segmentId = await newsletterSegmentId(resend);
		let count = 0;
		let after: string | undefined;
		for (let page = 0; page < 20; page += 1) {
			const { data } = await resend.contacts.list({ segmentId, limit: 100, ...(after ? { after } : {}) });
			if (!data) break;
			count += data.data.filter((contact) => !contact.unsubscribed).length;
			if (!data.has_more || !data.data.length) break;
			after = data.data[data.data.length - 1].id;
		}
		return NextResponse.json({ subscribers: count });
	} catch (error) {
		console.error("Unable to load subscribers", error);
		return NextResponse.json({ error: "Unable to load subscribers." }, { status: 502 });
	}
}

export async function POST(req: Request) {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const raw = (await req.json().catch(() => null)) as Record<string, unknown> | null;
	// Accept links typed without a scheme, e.g. "clubcrumbie.com".
	if (raw && typeof raw.buttonUrl === "string" && raw.buttonUrl.trim() && !/^https?:\/\//i.test(raw.buttonUrl.trim())) raw.buttonUrl = `https://${raw.buttonUrl.trim()}`;
	const parsed = schema.safeParse(raw);
	if (!parsed.success) {
		const field = parsed.error.issues[0]?.path[0];
		const messages: Record<string, string> = {
			subject: "Add a subject.",
			body: "Add a message.",
			buttonLabel: "Button text is too long.",
			buttonUrl: "Enter a valid button link, e.g. https://clubcrumbie.com.",
			scheduledAt: "Enter a valid schedule date.",
		};
		return NextResponse.json({ error: messages[String(field)] || "Check the newsletter details and try again." }, { status: 400 });
	}
	const { mode, subject, body, buttonLabel, buttonUrl, scheduledAt, images = [] } = parsed.data;
	const button = buttonLabel && buttonUrl ? { label: buttonLabel, url: buttonUrl } : undefined;
	const html = newsletterHtml(body, button, images);
	const text = `${body.replace(/\[image \d+\]\s*/g, "").trim()}${button ? `\n\n${button.label}: ${button.url}` : ""}\n\nUnsubscribe: {{{RESEND_UNSUBSCRIBE_URL}}}`;

	try {
		const resend = newsletterClient();
		if (mode === "test") {
			const to = notificationRecipients("clubcrumbieadmin@gmail.com", process.env.CRUMBIE_NOTIFICATION_EMAIL);
			const { error } = await resend.emails.send({
				from: newsletterFrom,
				to,
				subject: `[Test] ${subject}`,
				html: html.replace("{{{RESEND_UNSUBSCRIBE_URL}}}", "#"),
				text: text.replace("{{{RESEND_UNSUBSCRIBE_URL}}}", "(unsubscribe link)"),
			});
			if (error) throw new Error(error.message);
			return NextResponse.json({ ok: true });
		}
		const segmentId = await newsletterSegmentId(resend);
		const { error } = await resend.broadcasts.create({
			segmentId,
			from: newsletterFrom,
			subject,
			name: subject,
			html,
			text,
			send: true,
			...(scheduledAt ? { scheduledAt } : {}),
		});
		if (error) throw new Error(error.message);
		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error("Unable to send newsletter", error);
		return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to send." }, { status: 502 });
	}
}
