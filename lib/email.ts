import "server-only";
import { Resend } from "resend";
import { getRecord } from "@/lib/store";

type Content = { fields: Record<string, string> };
type Enquiry = {
	id: string;
	name: string;
	email: string;
	phone: string;
	request: string;
};
type Order = {
	id: string;
	customer: { name: string; email: string };
	lines: Array<Record<string, unknown>>;
	currency: string | null;
	amountTotal: number | null;
};

const defaultTemplates = {
	confirmationSubject: "Your Club Crumbie order is confirmed",
	confirmationBody: `Hi {{customerName}},

Thanks for your order with Club Crumbie. We have received your payment and your cookie box is confirmed.

Order number: {{orderNumber}}
Pickup date: {{pickupDate}}
Pickup window: {{pickupWindow}}
Order total: {{orderTotal}}

Pickup is in Ivanhoe, Victoria. The exact address and final collection details will be provided separately.

Please keep this email for your records. We look forward to sharing your crumbs with you.

Club Crumbie`,
	enquirySubject: "New Club Crumbie enquiry from {{customerName}}",
	enquiryBody: `A new enquiry has been submitted through the Club Crumbie Contact Us form.

Name: {{customerName}}
Email: {{customerEmail}}
Phone: {{customerPhone}}

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

async function sendTextEmail(message: { to: string; subject: string; text: string; replyTo?: string }) {
	const apiKey = process.env.RESEND_API_KEY?.trim();
	const from = process.env.RESEND_FROM_EMAIL?.trim() || "Club Crumbie <hello@clubcrumbie.com>";
	if (!apiKey) throw new Error("Resend is not configured");

	const { error } = await new Resend(apiKey).emails.send({
		from,
		to: message.to,
		subject: singleLine(message.subject),
		text: message.text,
		replyTo: message.replyTo,
	});
	if (error) throw new Error(error.message);
}

export async function sendEnquiryNotification(enquiry: Enquiry) {
	const [templates, settings] = await Promise.all([
		contentFields("email templates"),
		contentFields("settings"),
	]);
	const to = settings.notificationEmail?.trim() || process.env.CRUMBIE_NOTIFICATION_EMAIL?.trim();
	if (!to) throw new Error("Notification email is not configured");

	const values = {
		customerName: enquiry.name,
		customerEmail: enquiry.email,
		customerPhone: enquiry.phone,
		customerMessage: enquiry.request,
	};
	await sendTextEmail({
		to,
		replyTo: enquiry.email,
		subject: renderTemplate(templates.enquirySubject || defaultTemplates.enquirySubject, values),
		text: renderTemplate(templates.enquiryBody || defaultTemplates.enquiryBody, values),
	});
}

export async function sendOrderConfirmation(order: Order) {
	if (!order.customer.email) throw new Error("Order customer email is missing");
	const templates = await contentFields("email templates");
	const currency = order.currency?.toUpperCase() || "AUD";
	const values = {
		customerName: order.customer.name || "there",
		orderNumber: order.id.slice(0, 8).toUpperCase(),
		pickupDate: uniqueLineValues(order.lines, "pickupDate"),
		pickupWindow: uniqueLineValues(order.lines, "pickupWindow"),
		orderTotal: new Intl.NumberFormat("en-AU", { style: "currency", currency }).format((order.amountTotal || 0) / 100),
	};
	await sendTextEmail({
		to: order.customer.email,
		subject: renderTemplate(templates.confirmationSubject || defaultTemplates.confirmationSubject, values),
		text: renderTemplate(templates.confirmationBody || defaultTemplates.confirmationBody, values),
	});
}