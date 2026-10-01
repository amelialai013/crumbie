import { normalizeProductImage } from "@/lib/product-image-normalization";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/session";
import { uploadMedia } from "@/lib/r2";
import { PRODUCT_IMAGE_COUNT, productSlugFromName } from "@/lib/catalog";

export const maxDuration = 300;

const MAX_REFERENCE_IMAGES = 5;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_GENERATED_IMAGES = PRODUCT_IMAGE_COUNT;

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
	const count = Number(form.get("count") || 1);
	const frameIndex = Number(form.get("frameIndex") || 0);
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
	if (!Number.isInteger(count) || count !== 1 || !Number.isInteger(frameIndex) || frameIndex < 0 || frameIndex >= MAX_GENERATED_IMAGES) {
		return NextResponse.json(
			{ error: "Request one frame at a time, with frameIndex between zero and eight." },
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
		const images = await Promise.all(Array.from({ length: count }, async () => {
			const index = frameIndex;
			const shotDirection = index === 0
				? "Storefront cover: show the cookie horizontally from a clean side profile, camera at edge height, showing its thickness."
				: index === 1
					? "Opening product-page rotation frame: true bird's-eye view looking straight down at the entire top of the cookie, centred."
					: `Rotation frame ${index} of eight: view the same cookie from ${(index - 1) * 45} degrees clockwise around its vertical axis from the front. Keep camera elevation at 35 degrees above the horizontal to show its top and thickness. Keep identity, lighting, scale and centre consistent.`;
			const framing = "Show one whole intact cookie. Leave at least 12% transparent margin on ALL four sides; no part of the cookie may touch or cross the image boundary.";
			const upstream = new FormData();
			upstream.set("model", "gpt-image-2.5-sunburst");
			upstream.set("prompt", `${prompt} ${shotDirection} ${framing}`);
			upstream.set("quality", "medium");
			upstream.set("size", "1024x1024");
			upstream.set("background", "transparent");
			upstream.set("output_format", "png");
			references.forEach((file) => upstream.append("image[]", file, file.name));
			let response!: Response;
			let result: { data?: Array<{ b64_json?: string }>; error?: { message?: string } } | null = null;
			for (let attempt = 0; attempt < 4; attempt++) {
				response = await fetch("https://api.openai.com/v1/images/edits", {
					method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: upstream, signal: AbortSignal.timeout(180_000),
				});
				result = await response.json().catch(() => null);
				if (response.status !== 429 || attempt === 3) break;
				const seconds = Number(response.headers.get("retry-after")) || Number(result?.error?.message?.match(/try again in ([\d.]+)s/i)?.[1]) || 20;
				await new Promise((resolve) => setTimeout(resolve, Math.min(60, Math.max(1, seconds)) * 1000));
			}
			if (!response.ok || !result?.data?.[0]?.b64_json) {
				throw new Error(result?.error?.message || "OpenAI did not return an image.");
			}
			return uploadMedia(
				`products/${productSlugFromName(name)}/generated-${timestamp}-${index + 1}.png`,
				await normalizeProductImage(Buffer.from(result.data[0].b64_json, "base64"), index === 0 ? "cover" : "rotation"),
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
