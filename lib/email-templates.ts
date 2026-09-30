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
