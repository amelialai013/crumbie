export type DeliveryOption = {
	enabled: boolean;
	fee: number;
	freeOver: number | null;
	postcodes: string;
	note: string;
	date: string;
	window: string;
};

export type DeliveryDetails = {
	name: string;
	street: string;
	suburb: string;
	postcode: string;
};

export const defaultDeliveryPostcodes = "3000-3099, 3101-3138, 3141-3196, 3204-3207";
export const defaultDeliveryNote = "Delivered within 30 km of Melbourne CBD";

function money(value: string | undefined) {
	const amount = Number(value);
	return value?.trim() && Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) / 100 : null;
}

// Delivery settings live in the "settings" content module as strings. Delivery is off until switched on.
export function deliveryFrom(fields: Record<string, string> | undefined): DeliveryOption {
	return {
		enabled: fields?.deliveryEnabled === "true",
		fee: money(fields?.deliveryFee) ?? 12,
		freeOver: money(fields?.deliveryFreeOver),
		postcodes: fields?.deliveryPostcodes?.trim() || defaultDeliveryPostcodes,
		note: fields?.deliveryNote === undefined ? defaultDeliveryNote : fields.deliveryNote.trim(),
		date: /^\d{4}-\d{2}-\d{2}$/.test(fields?.deliveryDate ?? "") ? fields!.deliveryDate : "",
		window: fields?.deliveryWindow?.trim() ?? "",
	};
}

// Accepts single postcodes and ranges separated by commas, spaces or new lines, e.g. "3000-3099, 3121".
export function postcodeAllowed(postcode: string, list: string) {
	const value = postcode.trim();
	if (!/^\d{4}$/.test(value)) return false;
	const code = Number(value);
	return list
		.split(/[\s,;]+/)
		.filter(Boolean)
		.some((entry) => {
			const [from, to] = entry.split(/[-–]/).map((part) => Number(part));
			if (!Number.isFinite(from)) return false;
			return code >= from && code <= (Number.isFinite(to) ? to : from);
		});
}

export function deliveryFeeFor(option: DeliveryOption, subtotal: number) {
	return option.freeOver !== null && option.freeOver > 0 && subtotal >= option.freeOver ? 0 : option.fee;
}
