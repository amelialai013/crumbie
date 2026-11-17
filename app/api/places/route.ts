import { NextResponse } from "next/server";

type Component = { longText?: string; shortText?: string; types?: string[] };
type Suggestion = { placeId: string; text: string; street: string; suburb: string; postcode: string };

const ENDPOINT = "https://places.googleapis.com/v1";

const parse = (components: Component[]) => {
	const find = (type: string) => components.find((item) => item.types?.includes(type));
	const unit = find("subpremise")?.longText;
	const number = find("street_number")?.longText;
	const route = find("route")?.longText;
	if (!number || !route) return null;
	return {
		street: `${unit ? `${unit}/` : ""}${number} ${route}`,
		suburb: (find("locality") || find("sublocality") || find("sublocality_level_1"))?.longText || "",
		state: find("administrative_area_level_1")?.shortText || "",
		postcode: find("postal_code")?.longText || "",
	};
};

export async function GET(req: Request) {
	const apiKey = process.env.GOOGLE_PLACES_API_KEY;
	if (!apiKey) return NextResponse.json({ enabled: false }, { status: 503 });

	const input = (new URL(req.url).searchParams.get("input") || "").trim().slice(0, 120);
	if (input.length < 3) return NextResponse.json({ suggestions: [] });

	try {
		const response = await fetch(`${ENDPOINT}/places:autocomplete`, {
			method: "POST",
			headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey },
			body: JSON.stringify({
				input,
				includedRegionCodes: ["au"],
				includedPrimaryTypes: ["street_address", "subpremise", "premise"],
				locationBias: { circle: { center: { latitude: -37.8136, longitude: 144.9631 }, radius: 50000 } },
			}),
			cache: "no-store",
		});
		if (!response.ok) return NextResponse.json({ error: "Search failed" }, { status: 502 });
		const data = (await response.json()) as { suggestions?: { placePrediction?: { placeId: string; text?: { text?: string } } }[] };
		const predictions = (data.suggestions || []).map((item) => item.placePrediction).filter((item): item is NonNullable<typeof item> => Boolean(item?.placeId)).slice(0, 5);

		const resolved = await Promise.all(
			predictions.map(async (prediction): Promise<Suggestion | null> => {
				try {
					const details = await fetch(`${ENDPOINT}/places/${encodeURIComponent(prediction.placeId)}`, {
						headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "addressComponents" },
						cache: "no-store",
						signal: AbortSignal.timeout(5000),
					});
					if (!details.ok) return null;
					const place = (await details.json()) as { addressComponents?: Component[] };
					const address = parse(place.addressComponents || []);
					if (!address || address.state !== "VIC" || !address.suburb || !address.postcode) return null;
					return { placeId: prediction.placeId, text: prediction.text?.text || "", street: address.street, suburb: address.suburb, postcode: address.postcode };
				} catch {
					return null;
				}
			}),
		);
		return NextResponse.json({ suggestions: resolved.filter((item): item is Suggestion => item !== null) });
	} catch {
		return NextResponse.json({ error: "Address search is unavailable" }, { status: 502 });
	}
}
