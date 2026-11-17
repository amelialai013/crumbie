import { NextResponse } from "next/server";

type Result = {
	place_id?: string;
	formatted?: string;
	housenumber?: string;
	street?: string;
	suburb?: string;
	district?: string;
	city?: string;
	postcode?: string;
	state_code?: string;
};

export async function GET(req: Request) {
	const apiKey = process.env.GEOAPIFY_API_KEY;
	if (!apiKey) return NextResponse.json({ enabled: false }, { status: 503 });

	const input = (new URL(req.url).searchParams.get("input") || "").trim().slice(0, 120);
	if (input.length < 3) return NextResponse.json({ suggestions: [] });

	try {
		const url = new URL("https://api.geoapify.com/v1/geocode/autocomplete");
		url.search = new URLSearchParams({
			text: input,
			format: "json",
			limit: "10",
			lang: "en",
			filter: "countrycode:au",
			bias: "proximity:144.9631,-37.8136",
			apiKey,
		}).toString();
		const response = await fetch(url, { cache: "no-store" });
		if (!response.ok) return NextResponse.json({ error: "Search failed" }, { status: 502 });
		const data = (await response.json()) as { results?: Result[] };
		const suggestions = (data.results || [])
			.filter((item) => item.place_id && item.street && item.state_code === "VIC")
			.slice(0, 5)
			.map((item) => ({
				placeId: item.place_id as string,
				text: item.formatted || "",
				street: [item.housenumber, item.street].filter(Boolean).join(" "),
				suburb: item.suburb || item.district || item.city || "",
				postcode: item.postcode || "",
			}));
		return NextResponse.json({ suggestions });
	} catch {
		return NextResponse.json({ error: "Address search is unavailable" }, { status: 502 });
	}
}
