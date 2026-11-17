import { NextResponse } from "next/server";

const tokenPattern = /^[A-Za-z0-9-]{16,64}$/;
const placePattern = /^[A-Za-z0-9_-]{10,200}$/;

type Component = { longText?: string; shortText?: string; types?: string[] };

export async function GET(req: Request) {
	const apiKey = process.env.GOOGLE_PLACES_API_KEY;
	if (!apiKey) return NextResponse.json({ enabled: false }, { status: 503 });

	const params = new URL(req.url).searchParams;
	const token = params.get("token") || "";
	if (!tokenPattern.test(token)) return NextResponse.json({ error: "Bad request" }, { status: 400 });

	try {
		const placeId = params.get("placeId");
		if (placeId) {
			if (!placePattern.test(placeId)) return NextResponse.json({ error: "Bad request" }, { status: 400 });
			const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}?sessionToken=${token}`, {
				headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "addressComponents" },
				cache: "no-store",
			});
			if (!response.ok) return NextResponse.json({ error: "Lookup failed" }, { status: 502 });
			const data = (await response.json()) as { addressComponents?: Component[] };
			const part = (type: string, short = false) => {
				const found = data.addressComponents?.find((item) => item.types?.includes(type));
				return (short ? found?.shortText : found?.longText) || "";
			};
			const unit = part("subpremise");
			const street = [part("street_number"), part("route")].filter(Boolean).join(" ");
			return NextResponse.json({
				street: unit && street ? `${unit}/${street}` : street,
				suburb: part("locality") || part("sublocality"),
				state: part("administrative_area_level_1", true),
				postcode: part("postal_code"),
			});
		}

		const input = (params.get("input") || "").trim().slice(0, 120);
		if (input.length < 3) return NextResponse.json({ suggestions: [] });
		const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
			method: "POST",
			headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey },
			body: JSON.stringify({
				input,
				sessionToken: token,
				includedRegionCodes: ["au"],
				includedPrimaryTypes: ["street_address", "subpremise", "premise"],
				locationBias: { circle: { center: { latitude: -37.8136, longitude: 144.9631 }, radius: 50000 } },
			}),
			cache: "no-store",
		});
		if (!response.ok) return NextResponse.json({ error: "Search failed" }, { status: 502 });
		const data = (await response.json()) as { suggestions?: Array<{ placePrediction?: { placeId: string; text?: { text?: string } } }> };
		const suggestions = (data.suggestions || [])
			.map((item) => item.placePrediction)
			.filter((item): item is { placeId: string; text?: { text?: string } } => Boolean(item?.placeId))
			.slice(0, 5)
			.map((item) => ({ placeId: item.placeId, text: item.text?.text || "" }));
		return NextResponse.json({ suggestions });
	} catch {
		return NextResponse.json({ error: "Address search is unavailable" }, { status: 502 });
	}
}
