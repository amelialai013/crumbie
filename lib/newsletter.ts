import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Resend } from "resend";
import { siteUrl } from "@/lib/site";
import { contentFields } from "@/lib/email";
import { emailLogoHtml, emailWrapStyle, subscribeConfirmDefaults as d } from "@/lib/email-templates";

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

export type NewsletterImage = { src: string; after: number };

export function newsletterHtml(body: string, button?: { label: string; url: string }, images: NewsletterImage[] = []) {
	const parts = body.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
	const picture = (src: string) => `<p style="margin:0 0 16px;"><img src="${escapeHtml(src)}" alt="" width="560" style="display:block;width:100%;max-width:560px;height:auto;border-radius:12px;border:0;" /></p>`;
	const at = (n: number) => images.filter((img) => (img.after < 0 || img.after > parts.length ? parts.length : img.after) === n).map((img) => picture(img.src)).join("");
	const paragraphs = at(0) + parts.map((part, i) => `<p style="margin:0 0 16px;">${escapeHtml(part).replace(/\n/g, "<br />")}</p>${at(i + 1)}`).join("");
	const cta = button ? `<p style="margin:24px 0;"><a href="${escapeHtml(button.url)}" style="display:inline-block;background:#1A140D;color:#EFCDAA;text-decoration:none;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-weight:600;font-size:15px;line-height:20px;letter-spacing:0;text-align:center;padding:15px 30px;border-radius:999px;">${escapeHtml(button.label)}</a></p>` : "";
	return wrap(`${paragraphs}${cta}<p style="margin:32px 0 0;font-size:12px;color:#7a6f63;">Club Crumbie · <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#7a6f63;">Unsubscribe</a></p>`);
}

type ConfirmCopy = { heading: string; body: string; button: string; footer: string };

const confirmationHtml = (url: string, sentAt: string, c: ConfirmCopy) =>
	`<div style="font-family:'DM Sans',Helvetica,Arial,sans-serif;color:#1A140D;max-width:560px;padding:40px 32px;${emailWrapStyle}"><a href="https://clubcrumbie.com" style="text-decoration:none;">${emailLogoHtml()}</a><h1 style="font-weight:400;font-size:40px;line-height:44px;letter-spacing:-0.035em;margin:48px 0 18px;color:#1A140D;">${escapeHtml(c.heading)}</h1><p style="margin:0 0 28px;font-size:16px;line-height:26px;color:#4A433A;max-width:400px;">${escapeHtml(c.body)}</p><a href="${escapeHtml(url)}" style="display:inline-block;background:#1A140D;color:#EFCDAA;text-decoration:none;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-weight:600;font-size:15px;line-height:20px;letter-spacing:0;text-align:center;padding:15px 30px;border-radius:999px;">${escapeHtml(c.button)}</a><div style="margin-top:44px;padding-top:20px;border-top:1px solid #DCCFBF;font-size:12px;color:#8A7D6F;">${escapeHtml(c.footer)}</div></div>`;

export async function sendConfirmationEmail(resend: Resend, email: string) {
	const url = confirmUrl(email);
	const t = await contentFields("email templates").catch(() => ({}) as Record<string, string>);
	const copy: ConfirmCopy = {
		heading: t.subscribeHeading || d.subscribeHeading,
		body: t.subscribeBody || d.subscribeBody,
		button: t.subscribeButtonLabel || d.subscribeButtonLabel,
		footer: t.subscribeFooter || d.subscribeFooter,
	};
	const subject = (t.subscribeSubject || d.subscribeSubject).replace(/[\r\n]+/g, " ").trim();
	// Gmail collapses repeated identical emails into a hidden "..." quote, so every send carries a unique timestamp.
	const sentAt = new Intl.DateTimeFormat("en-AU", { dateStyle: "medium", timeStyle: "medium", timeZone: "Australia/Sydney" }).format(new Date());
	const { error } = await resend.emails.send({
		from: newsletterFrom,
		to: email,
		subject,
		text: `${copy.heading}\n\n${copy.body}\n${url}\n\n${copy.footer}`,
		html: confirmationHtml(url, sentAt, copy),
	});
	if (error) throw new Error(error.message);
}
