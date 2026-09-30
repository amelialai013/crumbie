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
