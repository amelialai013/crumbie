import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Resend } from "resend";
import { siteUrl } from "@/lib/site";

export const newsletterFrom = process.env.RESEND_FROM_EMAIL?.trim() || "Club Crumbie <hello@clubcrumbie.com>";

export function newsletterClient() {
	const apiKey = process.env.RESEND_API_KEY?.trim();
	if (!apiKey) throw new Error("Resend is not configured");
	return new Resend(apiKey);
}

export async function newsletterSegmentId(resend: Resend) {
	if (process.env.RESEND_NEWSLETTER_SEGMENT_ID?.trim()) return process.env.RESEND_NEWSLETTER_SEGMENT_ID.trim();
	const list = await resend.segments.list();
	const existing = list.data?.data.find((segment) => segment.name === "Newsletter");
	if (existing) return existing.id;
	const created = await resend.segments.create({ name: "Newsletter" });
	if (!created.data) throw new Error(created.error?.message || "Unable to create segment");
	return created.data.id;
}

function sign(email: string) {
	return createHmac("sha256", process.env.RESEND_API_KEY?.trim() || "").update(`newsletter:${email}`).digest("hex");
}

export function confirmUrl(email: string) {
	return `${siteUrl}/api/subscribe/confirm?email=${encodeURIComponent(email)}&token=${sign(email)}`;
}

export function validConfirmToken(email: string, token: string) {
	const expected = Buffer.from(sign(email));
	const actual = Buffer.from(token);
	return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function escapeHtml(value: string) {
	return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] as string);
}

const wrap = (inner: string) =>
	`<div style="font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:15px;line-height:24px;color:#1A140D;max-width:560px;">${inner}</div>`;

export function newsletterHtml(body: string, button?: { label: string; url: string }) {
	const paragraphs = body.split(/\n{2,}/).map((part) => `<p style="margin:0 0 16px;">${escapeHtml(part.trim()).replace(/\n/g, "<br />")}</p>`).join("");
	const cta = button ? `<p style="margin:24px 0;"><a href="${escapeHtml(button.url)}" style="display:inline-block;background:#1A140D;color:#EFCDAA;text-decoration:none;font-weight:600;padding:12px 22px;border-radius:999px;">${escapeHtml(button.label)}</a></p>` : "";
	return wrap(`${paragraphs}${cta}<p style="margin:32px 0 0;font-size:12px;color:#7a6f63;">Club Crumbie · <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#7a6f63;">Unsubscribe</a></p>`);
}

const confirmationHtml = (url: string, sentAt: string) =>
	`<div style="font-family:'DM Sans',Helvetica,Arial,sans-serif;color:#1A140D;max-width:560px;padding:40px 32px;"><a href="https://clubcrumbie.com" style="text-decoration:none;"><img src="https://clubcrumbie.com/email/club-crumbie-logo-1-276.png" alt="Club Crumbie" width="136" height="13" style="display:block;width:136px;max-width:100%;height:auto;border:0;" /></a><h1 style="font-weight:400;font-size:40px;line-height:44px;letter-spacing:-0.035em;margin:48px 0 18px;color:#1A140D;">One last step, nearly in.</h1><p style="margin:0 0 28px;font-size:16px;line-height:26px;color:#4A433A;max-width:400px;">Confirm your email to start getting news about new boxes and seasonal flavours.</p><a href="${escapeHtml(url)}" style="display:inline-block;background:#1A140D;color:#EFCDAA;text-decoration:none;font-weight:600;font-size:15px;padding:15px 30px;border-radius:999px;">Confirm subscription</a><div style="margin-top:44px;padding-top:20px;border-top:1px solid #DCCFBF;font-size:12px;color:#8A7D6F;">If you didn't sign up, you can ignore this email.<br />Sent ${escapeHtml(sentAt)}</div></div>`;

export async function sendConfirmationEmail(resend: Resend, email: string) {
	const url = confirmUrl(email);
	// Gmail collapses repeated identical emails into a hidden "..." quote, so every send carries a unique timestamp.
	const sentAt = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "medium", timeZone: "Australia/Sydney" }).format(new Date());
	const { error } = await resend.emails.send({
		from: newsletterFrom,
		to: email,
		subject: "Confirm your Club Crumbie subscription",
		text: `Thanks for joining Club Crumbie.\n\nConfirm your email to start getting news about new boxes and seasonal flavours:\n${url}\n\nIf you didn't sign up, you can ignore this email.\n\nSent ${sentAt}`,
		html: confirmationHtml(url, sentAt),
	});
	if (error) throw new Error(error.message);
}
