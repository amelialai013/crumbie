export const pickupAddressToken = "{{pickupAddress}}";
export const pickupAddressLine = `Pickup address: ${pickupAddressToken}`;

const legacyPickupLine = /^[^\S\r\n]*Pickup is in Ivanhoe, Victoria\.[^\r\n]*$/m;
const summaryLine = /^(?:Order total|Order number|Pickup window|Pickup date):[^\r\n]*$/gm;

// Ensures pickup emails always reference the address saved in Settings.
export function withPickupAddress(body: string) {
	if (!body || body.includes(pickupAddressToken)) return body;
	if (legacyPickupLine.test(body)) return body.replace(legacyPickupLine, pickupAddressLine);

	const summaries = Array.from(body.matchAll(summaryLine));
	const last = summaries[summaries.length - 1];
	if (last?.index !== undefined) {
		const end = last.index + last[0].length;
		return `${body.slice(0, end)}\n${pickupAddressLine}${body.slice(end)}`;
	}
	return `${body.trimEnd()}\n\n${pickupAddressLine}`;
}

export const enquiryTypeToken = "{{enquiryType}}";
export const enquiryTypeLine = `Enquiry type: ${enquiryTypeToken}`;
export const enquiryTypeLabels: Record<string, string> = {
	general: "General enquiry",
	"custom-order": "Custom order",
};
export const defaultEnquiryTypes = ["General enquiry", "Custom order"];
export const enquiryTypeMaxLength = 60;

// Enquiry types are stored in contact content as newline-separated labels.
export function parseEnquiryTypes(value: string | undefined) {
	const types = Array.from(
		new Set((value || "").split("\n").map((type) => type.trim()).filter(Boolean)),
	);
	return types.length ? types : defaultEnquiryTypes;
}

const contactLine = /^(?:Name|Email|Phone):[^\r\n]*$/gm;

// Ensures enquiry notifications always state which enquiry type was chosen.
export function withEnquiryType(body: string) {
	if (!body || body.includes(enquiryTypeToken)) return body;
	const contacts = Array.from(body.matchAll(contactLine));
	const last = contacts[contacts.length - 1];
	if (last?.index !== undefined) {
		const end = last.index + last[0].length;
		return `${body.slice(0, end)}\n${enquiryTypeLine}${body.slice(end)}`;
	}
	return `${enquiryTypeLine}\n\n${body.trimStart()}`;
}

export const subscribeConfirmDefaults = {
	subscribeSubject: "Confirm your Club Crumbie subscription",
	subscribeHeading: "One last step, nearly in.",
	subscribeBody: "Tap the button below to confirm your email and we'll start sending you delicious drops, new flavours and a few crumbs of gossip.",
	subscribeButtonLabel: "Yes, count me in",
	subscribeFooter: "Didn't sign up? No worries, just ignore this email and we'll leave you be.",
};

export const welcomeDefaults = {
	welcomeSubject: "Well, well, well… look who's joined the club 👀",
	welcomeBody: `Hey Crumbie,

First things first, welcome to the club! 💌

We're so happy you're here.

Club Crumbie is all about ridiculously good cookies, little moments of joy and having absolutely zero regrets about eating the last one.

Think of this as your official invitation to the sweeter side of life.

Expect delicious drops, new flavours, little surprises and a few crumbs of gossip along the way.

And trust us, we've got some pretty sweet things coming.

Stay crumbie,
Club Crumbie 🍪

P.S. Sharing is optional. We won't judge.`,
	welcomeButtonLabel: "Order now",
	welcomeButtonUrl: "https://clubcrumbie.com/crumbs",
};
