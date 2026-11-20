export const privacyBodyMaxChars = 1500;

export const privacyDefaults: { heading: string; body: string }[] = [
	{ heading: "Who we are", body: "Club Crumbie is a small cookie bakery in Ivanhoe, Victoria, Australia. You can reach us at clubcrumbieadmin@gmail.com." },
	{ heading: "What we collect", body: "When you place an order or send an enquiry we collect your name, email address, phone number, pickup details and any message or order notes you provide. Payments are processed by Stripe, so we never see or store your card details." },
	{ heading: "How we use it", body: "We use your information only to prepare and confirm your order, arrange pickup, reply to enquiries and meet our legal and tax obligations. We do not sell your information or use it for third-party advertising." },
	{ heading: "Who we share it with", body: "We share information only with the services that help us run the shop: Stripe for payments, our email provider for order and enquiry emails, and our hosting provider. These providers may process data outside Australia." },
	{ heading: "Cookies", body: "This site stores your cart in your browser so it persists between visits. We do not use advertising or tracking cookies." },
	{ heading: "Your rights", body: "You can ask to access, correct or delete the personal information we hold about you by emailing clubcrumbieadmin@gmail.com. We keep order records for as long as required for tax and consumer law purposes." },
];

export const privacyDefaultTitle = "Privacy policy";
export const privacyLimits: Record<string, number> = {
	pageTitle: 80,
	...Object.fromEntries(privacyDefaults.flatMap((_, i) => [[`s${i + 1}Heading`, 80], [`s${i + 1}Copy`, privacyBodyMaxChars]])),
};
