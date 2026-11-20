import { addressError } from "@/lib/address";
import { VIC_POSTCODES } from "@/lib/vic-postcodes";

export type DeliveryOption = {
	enabled: boolean;
	fee: number;
	pickupFee: number;
	freeOver: number | null;
	postcodes: string;
	radiusKm: string;
	slots: DeliverySlot[];
	info: string;
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

export const defaultDeliveryInfo = "We deliver within {km} km of Melbourne CBD.";

export const defaultAddressErrorMessage = addressError;

export const defaultDeliveryPostcodes = "3000-3099, 3101-3138, 3141-3196, 3204-3207";

function money(value: string | undefined) {
	const amount = Number(value);
	return value?.trim() && Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) / 100 : null;
}

// Delivery settings live in the "settings" content module as strings. Delivery is off until switched on.
export function deliveryFrom(fields: Record<string, string> | undefined, slots: DeliverySlot[] = []): DeliveryOption {
	const radiusKm = /^\d{1,3}$/.test(fields?.deliveryRadiusKm ?? "") ? fields!.deliveryRadiusKm : fields?.deliveryPostcodes ? radiusFromPostcodes(fields.deliveryPostcodes) : "";
	const infoTemplate = fields?.deliveryInfo?.trim() || (radiusKm ? defaultDeliveryInfo : "");
	return {
		enabled: fields?.deliveryEnabled === "true",
		fee: money(fields?.deliveryFee) ?? 10,
		pickupFee: money(fields?.pickupFee) ?? 0,
		freeOver: money(fields?.deliveryFreeOver),
		postcodes: fields?.deliveryPostcodes?.trim() || defaultDeliveryPostcodes,
		radiusKm,
		slots,
		info: infoTemplate.replaceAll("{km}", radiusKm),
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

export function postcodesWithinKm(km: number) {
  const [lat0, lng0] = [-37.8136, 144.9631];
  const rad = Math.PI / 180;
  const codes = VIC_POSTCODES.filter(([, lat, lng]) => {
    const a = Math.sin(((lat - lat0) * rad) / 2) ** 2 + Math.cos(lat0 * rad) * Math.cos(lat * rad) * Math.sin(((lng - lng0) * rad) / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(a)) <= km;
  }).map(([code]) => code);
  const ranges: string[] = [];
  for (let i = 0; i < codes.length; ) {
    let j = i;
    while (j + 1 < codes.length && codes[j + 1] === codes[j] + 1) j++;
    ranges.push(j > i ? `${codes[i]}-${codes[j]}` : `${codes[i]}`);
    i = j + 1;
  }
  return ranges.join(", ");
}

// Settings saved before the radius was stored: find the radius whose postcode list matches the saved one.
function radiusFromPostcodes(list: string) {
	const target = list.replace(/\s+/g, "");
	for (let km = 1; km <= 200; km++) if (postcodesWithinKm(km).replace(/\s+/g, "") === target) return String(km);
	return "";
}
