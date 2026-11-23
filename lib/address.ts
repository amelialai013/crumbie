export const addressError = "We couldn't find that address. Select an address from the suggestions or check the street, suburb and postcode.";

// Basic shape check that runs in the browser and on the server.
export const streetOk = (street: string) => /\d/.test(street) && /[a-z]{2}/i.test(street);
export const suburbOk = (suburb: string) => /[a-z]{2}/i.test(suburb);
// Relaxed check for manually typed addresses.
export const manualAddressOk = (street: string, suburb: string) => street.trim().length >= 3 && /[a-z]/i.test(street) && suburbOk(suburb);
export const addressShapeOk = (street: string, suburb: string) => streetOk(street) && suburbOk(suburb);

type Component = { longText?: string; shortText?: string; types?: string[] };

// Confirms the address resolves to a real street address with the same postcode. Fails open if the lookup is unavailable.
export async function addressExists(street: string, suburb: string, postcode: string) {
	const apiKey = process.env.GOOGLE_PLACES_API_KEY;
	if (!apiKey) return true;
	try {
		const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
			method: "POST",
			headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "places.addressComponents" },
			body: JSON.stringify({ textQuery: `${street}, ${suburb} VIC ${postcode}`, regionCode: "au", pageSize: 5 }),
			cache: "no-store",
			signal: AbortSignal.timeout(5000),
		});
		if (!response.ok) return true;
		const places = ((await response.json()) as { places?: { addressComponents?: Component[] }[] }).places ?? [];
		const numbers = [...street.replace(/^\s*[^\s]*\//, "").matchAll(/\d+[a-z]?/gi)].map((match) => match[0].toLowerCase());
		const wanted: string[] = numbers.slice(0, 1).concat(street.match(/(\d+[a-z]?)\s*[-–]\s*(\d+[a-z]?)/i)?.slice(1).map((value) => value.toLowerCase()) ?? []);
		return places.some(({ addressComponents: components }) => {
			if (!components) return false;
			const find = (type: string) => components.find((item) => item.types?.includes(type));
			const found = (find("street_number")?.longText ?? "").toLowerCase();
			const foundParts: string[] = found.match(/\d+[a-z]?/g) ?? [];
			const numberOk = foundParts.length > 0 && wanted.some((value) => foundParts.includes(value));
			return numberOk && Boolean(find("route")) && find("administrative_area_level_1")?.shortText === "VIC" && find("postal_code")?.longText === postcode.trim();
		});
	} catch {
		return true;
	}
}
