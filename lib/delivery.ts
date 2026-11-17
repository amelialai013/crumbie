import { addressError } from "@/lib/address";

export type DeliveryOption = {
	enabled: boolean;
	fee: number;
	pickupFee: number;
	freeOver: number | null;
	postcodes: string;
	slots: DeliverySlot[];
	pickupTitle: string;
	pickupDescription: string;
	deliveryTitle: string;
	deliveryDescription: string;
	deliverableMessage: string;
	undeliverableMessage: string;
	addressErrorMessage: string;
};

export type DeliverySlot = { id: string; date: string; window: string };

export type DeliveryDetails = {
	name: string;
	street: string;
	suburb: string;
	postcode: string;
};

export const defaultDeliverableMessage = "Great, we deliver to {postcode}.";
export const defaultUndeliverableMessage = "Sorry, we don't deliver to this postcode. Please order this product through pickup.";

export const defaultAddressErrorMessage = addressError;

export const defaultDeliveryPostcodes = "3000-3099, 3101-3138, 3141-3196, 3204-3207";

function money(value: string | undefined) {
	const amount = Number(value);
	return value?.trim() && Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) / 100 : null;
}

// Delivery settings live in the "settings" content module as strings. Delivery is off until switched on.
export function deliveryFrom(fields: Record<string, string> | undefined, slots: DeliverySlot[] = []): DeliveryOption {
	return {
		enabled: fields?.deliveryEnabled === "true",
		fee: money(fields?.deliveryFee) ?? 10,
		pickupFee: money(fields?.pickupFee) ?? 0,
		freeOver: money(fields?.deliveryFreeOver),
		postcodes: fields?.deliveryPostcodes?.trim() || defaultDeliveryPostcodes,
		slots,
		pickupTitle: fields?.pickupTitle?.trim() || "Pickup",
		pickupDescription: fields?.pickupDescription === undefined ? "Free · collect in Ivanhoe" : fields.pickupDescription.trim(),
		deliveryTitle: fields?.deliveryTitle?.trim() || "Delivery",
		deliveryDescription: fields?.deliveryDescription === undefined ? "" : fields.deliveryDescription.trim(),
		deliverableMessage: fields?.deliverableMessage?.trim() || defaultDeliverableMessage,
		undeliverableMessage: fields?.undeliverableMessage?.trim() || defaultUndeliverableMessage,
		addressErrorMessage: fields?.addressErrorMessage?.trim() || defaultAddressErrorMessage,
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
