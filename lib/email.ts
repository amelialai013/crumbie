import "server-only";
import { sendGmailReply } from "@/lib/gmail-sender";
import { Resend } from "resend";
import { emailLogoHtml, emailWrapStyle, welcomeDefaults, enquiryTypeLabels, withEnquiryType, withPickupAddress } from "@/lib/email-templates";
import { enquiryMailbox, enquiryReference, notificationRecipients } from "@/lib/enquiry-mail";
import { threadToken } from "@/lib/enquiry-thread";
import { formatPickupDate } from "@/lib/format-date";
import { siteUrl } from "@/lib/site";
import { getRecord } from "@/lib/store";
import { createWelcomeCode } from "@/lib/welcome-discount";

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
	customer: { name: string; email: string; phone?: string };
	lines: Array<Record<string, unknown>>;
	card?: { label: string; price: number; quantity?: number; names?: string[]; messages?: string[]; products?: string[] } | null;
	currency: string | null;
	amountTotal: number | null;
	fulfilment?: "pickup" | "delivery";
	delivery?: { name: string; street: string; suburb: string; postcode: string; source?: "autofill" | "manual" } | null;
	deliverySlot?: { date: string; window: string } | null;
	deliveryFee?: number | null;
};

const defaultNotificationEmail = "clubcrumbieadmin@gmail.com";

const defaultTemplates = {
	confirmationSubject: "Your Club Crumbie order is confirmed",
	confirmationBody: `Hi {{customerName}},

Thanks for your order with Club Crumbie. We have received your payment and your box is confirmed.

Order number: {{orderNumber}}
Pickup window: {{pickupDate}}, {{pickupWindow}}
Order total: {{orderTotal}}
Pickup address: {{pickupAddress}}

Please keep this email for your records. We look forward to sharing your crumbs with you.

Club Crumbie`,
	pickupReminderSubject: "Your Club Crumbie pickup is coming up",
	pickupReminderBody: `Hi {{customerName}},

Just a reminder that your Club Crumbie order is ready for pickup soon.

Pickup window: {{pickupDate}}, {{pickupWindow}}
Order number: {{orderNumber}}
Pickup address: {{pickupAddress}}

Please arrive during your pickup window so we can hand over your box while it is fresh.

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
	return Array.from(new Set(lines.map((line) => line[key]).filter((value): value is string => typeof value === "string" && value.length > 0).map((value) => (key === "pickupDate" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? formatPickupDate(value) : value)))).join(", ");
}

// Older stored templates split the date and time onto two "Pickup window:" lines.
function mergePickupWindow(body: string) {
	return body.replace(/^Pickup (?:date|window): ([^\r\n]+)\r?\nPickup window: /m, "Pickup window: $1, ");
}

export async function contentFields(moduleName: string) {
	return (await getRecord<Content>("content", moduleName))?.fields || {};
}

async function linkedSubject(id: string, subject: string) {
 const ready = await getRecord<{ version?: number }>("integration", "gmail-headers");
 return ready?.version === 2 ? subject : `${enquiryReference(id)} ${subject}`;
}

const signatureText = "\n\nClub Crumbie\nclubcrumbieadmin@gmail.com\nclubcrumbie.com\nInstagram: instagram.com/clubcrumbie\nTikTok: tiktok.com/@clubcrumbie\nFacebook: facebook.com/clubcrumbie";
const signatureHtml = `<table cellpadding="0" cellspacing="0" border="0" width="320" style="width:320px;max-width:100%;border-collapse:collapse;font-family:Helvetica,Arial,sans-serif;margin-top:28px;"><tr><td style="padding:0 0 14px;"><a href="https://clubcrumbie.com" style="text-decoration:none;">${emailLogoHtml()}</a></td></tr><tr><td style="padding:0;font-size:14px;line-height:21px;color:#1A140D;"><div style="font-size:14px;line-height:21px;font-weight:bold;padding-bottom:4px;">Club Crumbie</div><a href="mailto:clubcrumbieadmin@gmail.com" style="color:#1A140D;text-decoration:none;">clubcrumbieadmin@gmail.com</a><br /><a href="https://clubcrumbie.com" style="color:#1A140D;text-decoration:none;">clubcrumbie.com</a><div style="padding-top:12px;font-size:13px;line-height:20px;"><a href="https://instagram.com/clubcrumbie" style="color:#1A140D;text-decoration:underline;">Instagram</a>&nbsp;&nbsp;&nbsp; <a href="https://tiktok.com/@clubcrumbie" style="color:#1A140D;text-decoration:underline;">TikTok</a>&nbsp;&nbsp;&nbsp; <a href="https://facebook.com/clubcrumbie" style="color:#1A140D;text-decoration:underline;">Facebook</a></div></td></tr></table>`;

function escapeHtml(value: string) {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendTextEmail(message: { to: string | string[]; subject: string; text: string; replyTo?: string; headers?: Record<string, string>; bcc?: string; signature?: boolean; button?: { label: string; url: string } }) {
	const apiKey = process.env.RESEND_API_KEY?.trim();
	const from = process.env.RESEND_FROM_EMAIL?.trim() || "Club Crumbie <hello@clubcrumbie.com>";
	if (!apiKey) throw new Error("Resend is not configured");

	const { error } = await new Resend(apiKey).emails.send({
		from,
		to: message.to,
		subject: singleLine(message.subject),
		text: message.signature ? message.text + signatureText : message.text,
		html: message.signature || message.button
			? `<div style="white-space:pre-wrap;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:14px;line-height:22px;color:#1A140D;">${escapeHtml(message.text).replace(/\r?\n/g, "<br />")}</div>${message.button ? `<p style="margin:20px 0;"><a href="${escapeHtml(message.button.url)}" style="display:inline-block;background:#1A140D;color:#EFCDAA;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:15px;line-height:20px;font-weight:600;text-decoration:none;padding:15px 30px;border-radius:999px;">${escapeHtml(message.button.label)}</a></p>` : ""}${message.signature ? signatureHtml : ""}`
			: undefined,
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

export async function sendOrderEmail(email: { to: string; subject: string; message: string }) {
	await sendTextEmail({ to: email.to, subject: email.subject, text: email.message, replyTo: enquiryMailbox, bcc: enquiryMailbox, signature: true });
}

function orderRecap(order: Order, currency: string, mixed = false) {
	const money = new Intl.NumberFormat("en-AU", { style: "currency", currency });
	const item = (line: Record<string, unknown>) => {
		const quantity = Number(line.quantity) || 1;
		const unit = Number(line.unitPrice) || 0;
		const name = [line.productName, line.variantLabel].filter((part) => typeof part === "string" && part).join(" — ");
		return `${quantity} × ${name || "Cookie box"} (${money.format(quantity * unit)})`;
	};
	const cardLines: string[] = [];
	const card = order.card;
	if (card) {
		const quantity = card.quantity ?? 1;
		cardLines.push(`${quantity} × ${card.label} (${money.format(quantity * card.price)})`);
		(card.messages ?? []).forEach((message, i) => {
			if (!card.names?.[i] && !message) return;
			cardLines.push(`Card ${i + 1}${card.names?.[i] ? ` to ${card.names[i]}` : ""}${card.products?.[i] ? ` (${card.products[i]})` : ""}: ${message.replace(/\s+/g, " ").trim() || "(blank)"}`);
		});
	}
	const fee = Number(order.deliveryFee) || 0;
	const feeLine = fee > 0 ? [`1 x Delivery (${money.format(fee)})`] : [];
	if (mixed) {
		const pickup = order.lines.filter((line) => line.fulfilment !== "delivery").map(item);
		const delivery = [...order.lines.filter((line) => line.fulfilment === "delivery").map(item), ...cardLines];
		return `Pickup:\n${pickup.join("\n")}\n\nDelivery:\n${delivery.join("\n")}${feeLine.length ? `\n${feeLine[0]}` : ""}`;
	}
	return `Order summary:\n${[...order.lines.map(item), ...cardLines, ...feeLine].join("\n")}`;
}

// Places the recap above the closing "keep this email" line, or at the end if the template has none.
function withOrderRecap(body: string, recap: string) {
	body = body.replace(/\s*\n\s*Club Crumbie\s*$/, "");
	const closing = body.search(/^Please keep this email for your records/m);
	if (closing === -1) return `${body.trimEnd()}\n\n${recap}`;
	return `${body.slice(0, closing)}${recap}\n\n${body.slice(closing)}`;
}

export async function sendOrderConfirmation(order: Order) {
	if (!order.customer.email) throw new Error("Order customer email is missing");
	const [templates, settings] = await Promise.all([
		contentFields("email templates"),
		contentFields("settings"),
	]);
	const currency = order.currency?.toUpperCase() || "AUD";
	const hasDelivery = order.fulfilment === "delivery" && !!order.delivery;
	const pickupLines = order.lines.filter((line) => line.fulfilment !== "delivery");
	const mixed = hasDelivery && pickupLines.length > 0;
	const slot = hasDelivery && !mixed ? order.deliverySlot : null;
	const savedPickupAddress = singleLine(settings.pickupAddress || "") || "Ivanhoe, Victoria (exact address to follow)";
	const deliveryAddress = hasDelivery && order.delivery ? `Delivery address: ${singleLine(`${order.delivery.name}, ${order.delivery.street}, ${order.delivery.suburb} VIC ${order.delivery.postcode}`)}` : "";
	const values = {
		customerName: order.customer.name || "there",
		pickupAddress: savedPickupAddress,
		orderNumber: order.id.slice(0, 8).toUpperCase(),
		pickupDate: slot ? formatPickupDate(slot.date) : uniqueLineValues(mixed ? pickupLines : order.lines, "pickupDate"),
		pickupWindow: slot ? slot.window : uniqueLineValues(mixed ? pickupLines : order.lines, "pickupWindow"),
		orderTotal: new Intl.NumberFormat("en-AU", { style: "currency", currency }).format((order.amountTotal || 0) / 100),
	};
	let body = mergePickupWindow(renderTemplate(withPickupAddress(templates.confirmationBody || defaultTemplates.confirmationBody), values));
	// A saved template may still carry the old wording.
	body = body.replace("your cookie box is confirmed.", "your box is confirmed.");
	if (mixed) {
		const slot = order.deliverySlot;
		const header = [
			`Order number: ${values.orderNumber}`,
			`Pickup window: ${values.pickupDate}, ${values.pickupWindow}`,
			`Pickup address: ${savedPickupAddress}`,
			slot ? `Delivery window: ${formatPickupDate(slot.date)}, ${slot.window}` : "",
			deliveryAddress,
			`Order total: ${values.orderTotal}`,
		].filter(Boolean);
		body = body.replace(/^Order number:[\s\S]*?^Pickup address:[^\r\n]*$/m, header.join("\n"));
	} else if (hasDelivery) body = body.replace(/^Pickup window:/m, "Delivery window:").replace(/^Pickup address:[^\r\n]*$/m, deliveryAddress);
	await sendTextEmail({
		to: order.customer.email,
		subject: renderTemplate(templates.confirmationSubject || defaultTemplates.confirmationSubject, values),
		text: withOrderRecap(body, orderRecap(order, currency, mixed)),
		signature: true,
	});
}

export async function sendOrderNotification(order: Order) {
	const settings = await contentFields("settings");
	const to = notificationRecipients(defaultNotificationEmail, settings.notificationEmail, process.env.CRUMBIE_NOTIFICATION_EMAIL);
	if (!to) throw new Error("Notification email is not configured");
	const pickupAddress = singleLine(settings.pickupAddress || "") || "Ivanhoe, Victoria (exact address to follow)";
	const currency = order.currency?.toUpperCase() || "AUD";
	const hasDelivery = order.fulfilment === "delivery" && !!order.delivery;
	const pickupLines = order.lines.filter((line) => line.fulfilment !== "delivery");
	const mixed = hasDelivery && pickupLines.length > 0;
	const orderNumber = order.id.slice(0, 8).toUpperCase();
	const total = new Intl.NumberFormat("en-AU", { style: "currency", currency }).format((order.amountTotal || 0) / 100);
	const slot = order.deliverySlot;
	const details = [
		`Order number: ${orderNumber}`,
		`Customer: ${order.customer.name || "—"}`,
		`Email: ${order.customer.email || "—"}`,
		order.customer.phone ? `Phone: ${order.customer.phone}` : "",
		`Order total: ${total}`,
		pickupLines.length ? `Pickup window: ${uniqueLineValues(pickupLines, "pickupDate")}, ${uniqueLineValues(pickupLines, "pickupWindow")}` : "",
		pickupLines.length ? `Pickup address: ${pickupAddress}` : "",
		hasDelivery && slot ? `Delivery window: ${formatPickupDate(slot.date)}, ${slot.window}` : "",
		hasDelivery && order.delivery ? `Delivery address: ${singleLine(`${order.delivery.name}, ${order.delivery.street}, ${order.delivery.suburb} VIC ${order.delivery.postcode}`)}` : "",
	].filter(Boolean);
	await sendTextEmail({
		to,
		replyTo: order.customer.email || undefined,
		subject: `New order ${orderNumber} from ${order.customer.name || "a customer"} (${total})`,
		text: `You have a new Club Crumbie order.\n\n${details.join("\n")}\n\n${orderRecap(order, currency, mixed)}`,
		button: { label: "View order in portal", url: `${siteUrl}/admin?tab=orders` },
	});
}

export async function sendPickupReminder(order: Order, slot: { date: string; window: string }) {
	if (!order.customer.email) throw new Error("Order customer email is missing");
	const [templates, settings] = await Promise.all([contentFields("email templates"), contentFields("settings")]);
	const values = {
		customerName: order.customer.name || "there",
		pickupAddress: singleLine(settings.pickupAddress || "") || "Ivanhoe, Victoria (exact address to follow)",
		orderNumber: order.id.slice(0, 8).toUpperCase(),
		pickupDate: formatPickupDate(slot.date),
		pickupWindow: slot.window,
	};
	await sendTextEmail({
		to: order.customer.email,
		subject: renderTemplate(templates.pickupReminderSubject || defaultTemplates.pickupReminderSubject, values),
		text: mergePickupWindow(renderTemplate(withPickupAddress(templates.pickupReminderBody || defaultTemplates.pickupReminderBody), values)),
		replyTo: enquiryMailbox,
	});
}

export async function sendWelcomeEmail(to: string) {
	const apiKey = process.env.RESEND_API_KEY?.trim();
	if (!apiKey) throw new Error("Resend is not configured");
	const from = process.env.RESEND_FROM_EMAIL?.trim() || "Club Crumbie <hello@clubcrumbie.com>";
	const templates = await contentFields("email templates");
	const subject = singleLine(templates.welcomeSubject || welcomeDefaults.welcomeSubject);
	const body = templates.welcomeBody || welcomeDefaults.welcomeBody;
	const label = (templates.welcomeButtonLabel ?? welcomeDefaults.welcomeButtonLabel).trim();
	const rawUrl = (templates.welcomeButtonUrl || welcomeDefaults.welcomeButtonUrl).trim();
	const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
	const hasButton = !!label && !!rawUrl;
	const discount = await createWelcomeCode({ enabled: templates.welcomeDiscountEnabled, type: templates.welcomeDiscountType, value: templates.welcomeDiscountValue }).catch((error) => { console.error("Unable to create welcome code", error); return null; });
	const expiry = discount ? discount.expiresAt.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "Australia/Melbourne" }) : "";
	const codeHtml = discount ? `<div style="margin:28px 0 0;padding:20px 24px;border:1px dashed #4A433A;border-radius:16px;max-width:360px;"><p style="margin:0 0 8px;font-size:14px;line-height:20px;color:#4A433A;">Your ${discount.label} off code</p><p style="margin:0 0 8px;font-size:24px;line-height:30px;font-weight:600;letter-spacing:0.04em;color:#1A140D;">${discount.code}</p><p style="margin:0;font-size:13px;line-height:18px;color:#4A433A;">One use only, just for you. Enter it at checkout before ${expiry}.</p></div>` : "";
	const paragraphs = body.split(/\n{2,}/).map((part) => `<p style="margin:0 0 16px;">${escapeHtml(part.trim()).replace(/\n/g, "<br />")}</p>`).join("");
	const cta = codeHtml + (hasButton ? `<p style="margin:28px 0 0;"><a href="${escapeHtml(url)}" style="display:inline-block;background:#1A140D;color:#EFCDAA;text-decoration:none;font-family:'DM Sans',Helvetica,Arial,sans-serif;font-weight:600;font-size:15px;line-height:20px;letter-spacing:0;text-align:center;padding:15px 30px;border-radius:999px;">${escapeHtml(label)}</a></p>` : "");
	const html = `<div style="font-family:'DM Sans',Helvetica,Arial,sans-serif;font-size:15px;line-height:24px;color:#1A140D;max-width:560px;padding:40px 32px;${emailWrapStyle}"><a href="https://clubcrumbie.com" style="text-decoration:none;">${emailLogoHtml("margin-bottom:36px;")}</a>${paragraphs}${cta}<div style="margin-top:40px;padding-top:20px;border-top:1px solid #DCCFBF;font-size:12px;color:#8A7D6F;">You're getting this because you joined Club Crumbie.</div></div>`;
	const { error } = await new Resend(apiKey).emails.send({ from, to, subject, text: [body, discount ? `Your ${discount.label} off code: ${discount.code} (one use only, expires ${expiry})` : "", hasButton ? `${label}: ${url}` : ""].filter(Boolean).join("\n\n"), html });
	if (error) throw new Error(error.message);
}
