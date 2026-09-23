import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/session";
import { uploadMedia } from "@/lib/r2";
import { productSlugFromName } from "@/lib/catalog";

const MAX_REFERENCE_IMAGES = 5;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_GENERATED_IMAGES = 4;

function imageFile(value: FormDataEntryValue): value is File {
	return value instanceof File && value.size > 0;
}

export async function POST(request: Request) {
	if (!(await isAdmin())) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) {
		return NextResponse.json(
			{ error: "OpenAI image generation is not configured." },
			{ status: 503 },
		);
	}

	const form = await request.formData();
	const name = String(form.get("name") || "").trim();
	const direction = String(form.get("direction") || "").trim();
	const count = Number(form.get("count") || 3);
	const references = form.getAll("references").filter(imageFile);
	if (!name) {
		return NextResponse.json({ error: "Product name is required." }, { status: 400 });
	}
	if (!references.length) {
		return NextResponse.json(
			{ error: "Add at least one reference photo before generating." },
			{ status: 400 },
		);
	}
	if (!Number.isInteger(count) || count < 1 || count > MAX_GENERATED_IMAGES) {
		return NextResponse.json(
			{ error: "Choose between one and four generated images." },
			{ status: 400 },
		);
	}
	if (
		references.length > MAX_REFERENCE_IMAGES ||
		references.some(
			(file) => !file.type.startsWith("image/") || file.size > MAX_IMAGE_BYTES,
		)
	) {
		return NextResponse.json(
			{ error: "Use up to five image files, each under 10MB." },
			{ status: 400 },
		);
	}

	const prompt = [
		`Create a premium ecommerce product photograph for "${name}".`,
		"Use the supplied reference photos as the sole source of truth for the cookie's identity. Preserve its true shape, colour, texture, topping, inclusions, and scale exactly; never substitute a generic chocolate-chip cookie or copy another Club Crumbie product.",
		"Cut out one cookie cleanly on a fully transparent background. Preserve a natural, subtle contact shadow beneath it, with no plate, packaging, props, text, watermark, logos, or background colour.",
		"Match Club Crumbie's refined, high-end product photography style. The cookie must be sharply focused and realistically lit.",
		direction && `Additional creative direction: ${direction}`,
	]
		.filter(Boolean)
		.join(" ");

	try {
		const timestamp = Date.now();
		const images = await Promise.all(Array.from({ length: count }, async (_, index) => {
			const shotDirections = [
				"This is the primary storefront cover: show the referenced cookie in a clean side-on profile. Match only the Signature Crumbie page's cut-out presentation, never its cookie appearance. Keep the entire cookie in frame and clearly show its own thickness, edge texture, and toppings.",
				"This is the opening product-page view: show the same whole cookie front-on, centred, and facing the camera. It must read as the primary image in a rotatable cookie view, not an overhead flat-lay or side profile.",
				"This is the next rotation frame: show the same whole cookie from a low right three-quarter angle. Preserve the front-on composition's scale, background, lighting, and exact cookie identity.",
				"This is the final rotation frame: show the same whole cookie from a low left three-quarter angle. It must complete a coherent rotation sequence with the front-on and right three-quarter frames; do not break, crop, or add props to the cookie.",
			];
			const shotDirection =
				shotDirections[index] ??
				"Create a distinct product-gallery angle that does not repeat any other generated composition.";
			const upstream = new FormData();
			upstream.set("model", "gpt-image-2.5-sunburst");
			upstream.set("prompt", `${prompt} ${shotDirection}`);
			upstream.set("quality", "medium");
			upstream.set("size", "1024x1024");
			upstream.set("background", "transparent");
			upstream.set("output_format", "png");
			references.forEach((file) => upstream.append("image[]", file, file.name));
			const response = await fetch("https://api.openai.com/v1/images/edits", {
				method: "POST",
				headers: { Authorization: `Bearer ${apiKey}` },
				body: upstream,
			});
			const result = (await response.json().catch(() => null)) as {
				data?: Array<{ b64_json?: string }>;
				error?: { message?: string };
			} | null;
			if (!response.ok || !result?.data?.[0]?.b64_json) {
				throw new Error(result?.error?.message || "OpenAI did not return an image.");
			}
			return uploadMedia(
				`products/${productSlugFromName(name)}/generated-${timestamp}-${index + 1}.png`,
				Buffer.from(result.data[0].b64_json, "base64"),
				"image/png",
			);
		}));
		return NextResponse.json({ images }, { status: 201 });
	} catch (error) {
		console.error("OpenAI image generation failed", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "The generated image could not be saved." },
			{ status: 503 },
		);
	}
}
