import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/session";
import { getProducts } from "@/lib/catalog-store";

export async function POST(request: Request) {
	if (!(await isAdmin())) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		return NextResponse.json(
			{ error: "OpenAI description generation is not configured." },
			{ status: 503 },
		);
	}

	const body = await request.json().catch(() => null);
	const name = String(body?.name || "").trim();
	if (!name) {
		return NextResponse.json({ error: "Product name is required." }, { status: 400 });
	}

	const products = await getProducts();
	const examples = products
		.filter((product) => product.description.trim())
		.map((product) => `${product.name}: ${product.description}`);

	const prompt = [
		"You write short product descriptions for Club Crumbie, a small-batch cookie brand.",
		"Write one new description for a cookie box product named " + JSON.stringify(name) + ".",
		"Match the tone, structure, and length of these existing Club Crumbie descriptions exactly:",
		...examples.map((example) => `- ${example}`),
		"Write a single sentence, similar in length to the examples above (roughly the same word count). Describe texture, flavour, and standout ingredients implied by the product name. Do not mention the product name, price, or add quotation marks. Return only the description text.",
	].join("\n");

	try {
		const response = await fetch("https://api.openai.com/v1/chat/completions", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: "gpt-5-mini",
				messages: [{ role: "user", content: prompt }],
			}),
		});
		const result = (await response.json().catch(() => null)) as {
			choices?: Array<{ message?: { content?: string } }>;
			error?: { message?: string };
		} | null;
		const description = result?.choices?.[0]?.message?.content?.trim().replace(/^"|"$/g, "");
		if (!response.ok || !description) {
			throw new Error(result?.error?.message || "OpenAI did not return a description.");
		}
		return NextResponse.json({ description }, { status: 201 });
	} catch (error) {
		console.error("OpenAI description generation failed", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "The description could not be generated." },
			{ status: 503 },
		);
	}
}
