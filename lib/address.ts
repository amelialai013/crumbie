type Match = { postcode?: string; state_code?: string; result_type?: string; rank?: { confidence?: number } };

export const addressError = "We couldn't find that address. Pick it from the suggestions or check the street, suburb and postcode.";

// Basic shape check that runs in the browser and on the server.
export const streetOk = (street: string) => /\d/.test(street) && /[a-z]{2}/i.test(street);
export const suburbOk = (suburb: string) => /[a-z]{2}/i.test(suburb);
export const addressShapeOk = (street: string, suburb: string) => streetOk(street) && suburbOk(suburb);

// Confirms the address resolves to a real street address with the same postcode. Fails open if the lookup is unavailable.
export async function addressExists(street: string, suburb: string, postcode: string) {
	const apiKey = process.env.GEOAPIFY_API_KEY;
	if (!apiKey) return true;
	try {
		const url = new URL("https://api.geoapify.com/v1/geocode/search");
		url.search = new URLSearchParams({ text: `${street}, ${suburb} VIC ${postcode}`, filter: "countrycode:au", format: "json", limit: "1", lang: "en", apiKey }).toString();
		const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5000) });
		if (!response.ok) return true;
		const match = ((await response.json()) as { results?: Match[] }).results?.[0];
		if (!match) return false;
		return match.state_code === "VIC" && match.postcode === postcode && ["building", "amenity", "street"].includes(match.result_type ?? "") && (match.rank?.confidence ?? 0) >= 0.7;
	} catch {
		return true;
	}
}
