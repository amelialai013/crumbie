import "server-only";
import { sendGmailReply } from "@/lib/gmail-sender";
import { Resend } from "resend";
import { enquiryTypeLabels, withEnquiryType, withPickupAddress } from "@/lib/email-templates";
import { enquiryMailbox, enquiryReference, notificationRecipients } from "@/lib/enquiry-mail";
import { threadToken } from "@/lib/enquiry-thread";
import { getRecord } from "@/lib/store";

type Content = { fields: Record<string, string> };
type Enquiry = {
	id: string;
	name: string;
	email: string;
	phone: string;
	request: string;
	enquiryType?: string;
};
type Order = {
	id: string;
	customer: { name: string; email: string };
	lines: Array<Record<string, unknown>>;
	card?: { label: string; price: number; quantity?: number; messages?: string[]; products?: string[] } | null;
	currency: string | null;
	amountTotal: number | null;
};

const defaultNotificationEmail = "clubcrumbieadmin@gmail.com";

const defaultTemplates = {
	confirmationSubject: "Your Club Crumbie order is confirmed",
	confirmationBody: `Hi {{customerName}},

Thanks for your order with Club Crumbie. We have received your payment and your cookie box is confirmed.

Order number: {{orderNumber}}
Pickup date: {{pickupDate}}
Pickup window: {{pickupWindow}}
Order total: {{orderTotal}}
Pickup address: {{pickupAddress}}

Please keep this email for your records. We look forward to sharing your crumbs with you.

Club Crumbie`,
	enquirySubject: "New Club Crumbie enquiry from {{customerName}}",
	enquiryBody: `A new enquiry has been submitted through the Club Crumbie Contact Us form.

Name: {{customerName}}
Email: {{customerEmail}}
Phone: {{customerPhone}}
Enquiry type: {{enquiryType}}

Message:
{{customerMessage}}

Please reply to the customer directly when you are ready to follow up.

Club Crumbie`,
};

function renderTemplate(template: string, values: Record<string, string>) {
	return template.replace(/{{(\w+)}}/g, (match, key: string) => values[key] ?? match);
}

function singleLine(value: string) {
	return value.replace(/[\r\n]+/g, " ").trim();
}

function uniqueLineValues(lines: Order["lines"], key: "pickupDate" | "pickupWindow") {
	return Array.from(new Set(lines.map((line) => line[key]).filter((value): value is string => typeof value === "string" && value.length > 0))).join(", ");
}

async function contentFields(moduleName: string) {
	return (await getRecord<Content>("content", moduleName))?.fields || {};
}

async function linkedSubject(id: string, subject: string) {
 const ready = await getRecord<{ version?: number }>("integration", "gmail-headers");
 return ready?.version === 2 ? subject : `${enquiryReference(id)} ${subject}`;
}

const signatureText = "\n\nClub Crumbie\nclubcrumbieadmin@gmail.com\nclubcrumbie.com\nInstagram: instagram.com/clubcrumbie\nTikTok: tiktok.com/@clubcrumbie\nFacebook: facebook.com/clubcrumbie";
const signatureHtml = `<table cellpadding="0" cellspacing="0" border="0" width="320" style="width:320px;max-width:100%;border-collapse:collapse;font-family:Helvetica,Arial,sans-serif;margin-top:28px;"><tr><td style="padding:0 0 14px;"><a href="https://clubcrumbie.com" style="text-decoration:none;"><img src="https://clubcrumbie.com/email/club-crumbie-logo-1-276.png" alt="" role="presentation" width="272" height="26" style="display:block;width:272px;max-width:100%;height:auto;border:0;" /></a></td></tr><tr><td style="padding:0;font-size:14px;line-height:21px;color:#1A140D;"><div style="font-size:14px;line-height:21px;font-weight:bold;padding-bottom:4px;">Club Crumbie</div><a href="mailto:clubcrumbieadmin@gmail.com" style="color:#1A140D;text-decoration:none;">clubcrumbieadmin@gmail.com</a><br /><a href="https://clubcrumbie.com" style="color:#1A140D;text-decoration:none;">clubcrumbie.com</a><div style="padding-top:12px;font-size:13px;line-height:20px;"><a href="https://instagram.com/clubcrumbie" style="color:#1A140D;text-decoration:underline;">Instagram</a>&nbsp;&nbsp;&nbsp; <a href="https://tiktok.com/@clubcrumbie" style="color:#1A140D;text-decoration:underline;">TikTok</a>&nbsp;&nbsp;&nbsp; <a href="https://facebook.com/clubcrumbie" style="color:#1A140D;text-decoration:underline;">Facebook</a></div></td></tr></table>`;

function escapeHtml(value: string) {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendTextEmail(message: { to: string | string[]; subject: string; text: string; replyTo?: string; headers?: Record<string, string>; bcc?: string; signature?: boolean }) {
	const apiKey = process.env.RESEND_API_KEY?.trim();
	const from = process.env.RESEND_FROM_EMAIL?.trim() || "Club Crumbie <hello@clubcrumbie.com>";
	if (!apiKey) throw new Error("Resend is not configured");

	const { error } = await new Resend(apiKey).emails.send({
		from,
		to: message.to,
		subject: singleLine(message.subject),
		text: message.signature ? message.text + signatureText : message.text,
		html: message.signature ? `<div style="white-space:pre-wrap;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#1A140D;">${escapeHtml(message.text).replace(/\r?\n/g, "<br />")}</div>${signatureHtml}` : undefined,
		replyTo: message.replyTo,
		headers: message.headers,
		bcc: message.bcc,
	});
	if (error) throw new Error(error.message);
}

export async function sendEnquiryNotification(enquiry: Enquiry) {
	const [templates, settings] = await Promise.all([
		contentFields("email templates"),
		contentFields("settings"),
	]);
	const to = notificationRecipients(defaultNotificationEmail, settings.notificationEmail, process.env.CRUMBIE_NOTIFICATION_EMAIL);
	if (!to) throw new Error("Notification email is not configured");

	const values = {
		customerName: enquiry.name,
		customerEmail: enquiry.email,
		customerPhone: enquiry.phone,
		customerMessage: enquiry.request,
		enquiryType: enquiryTypeLabels[enquiry.enquiryType || "general"] || enquiry.enquiryType || "General enquiry",
	};
	await sendTextEmail({
		to,
		replyTo: enquiry.email,
		subject: await linkedSubject(enquiry.id, renderTemplate(templates.enquirySubject || defaultTemplates.enquirySubject, values)),
		headers: { "X-Crumbie-Enquiry": threadToken(enquiry.id) },
		text: renderTemplate(withEnquiryType(templates.enquiryBody || defaultTemplates.enquiryBody), values),
	});
}

export async function sendEnquiryReply(reply: { id: string; to: string; subject: string; message: string; requestId: string }) {
 const sender = await getRecord<{ url: string }>("integration", "gmail-sender");
 if (sender?.url) return sendGmailReply(sender.url, { ...reply, threadToken: threadToken(reply.id), text: reply.message + signatureText,
  html: `<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;">${escapeHtml(reply.message).replace(/\r?\n/g, "<br />")}</div>${signatureHtml}` });
	await sendTextEmail({ to: reply.to, subject: await linkedSubject(reply.id, reply.subject), text: reply.message, replyTo: enquiryMailbox, bcc: enquiryMailbox, signature: true, headers: { "X-Crumbie-Enquiry": threadToken(reply.id) } });
}

export async function sendOrderConfirmation(order: Order) {
	if (!order.customer.email) throw new Error("Order customer email is missing");
	const [templates, settings] = await Promise.all([
		contentFields("email templates"),
		contentFields("settings"),
	]);
	const currency = order.currency?.toUpperCase() || "AUD";
	const values = {
		customerName: order.customer.name || "there",
		pickupAddress: singleLine(settings.pickupAddress || "") || "Ivanhoe, Victoria (exact address to follow)",
		orderNumber: order.id.slice(0, 8).toUpperCase(),
		pickupDate: uniqueLineValues(order.lines, "pickupDate"),
		pickupWindow: uniqueLineValues(order.lines, "pickupWindow"),
		orderTotal: new Intl.NumberFormat("en-AU", { style: "currency", currency }).format((order.amountTotal || 0) / 100),
	};
	await sendTextEmail({
		to: order.customer.email,
		subject: renderTemplate(templates.confirmationSubject || defaultTemplates.confirmationSubject, values),
		text: renderTemplate(withPickupAddress(templates.confirmationBody || defaultTemplates.confirmationBody), values) + (order.card ? `\n\nIncluded in your order: ${order.card.quantity ?? 1} × ${order.card.label} ($${order.card.price.toFixed(2)} each)${order.card.messages?.some(Boolean) ? "\n" + order.card.messages.map((m, i) => `Card ${i + 1}${order.card?.products?.[i] ? ` (${order.card.products[i]})` : ""}: ${m || "(blank)"}`).join("\n") : ""}` : ""),
	});
}