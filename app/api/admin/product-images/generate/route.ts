import { rotationFrameIssue, rotationViews } from "@/lib/product-rotation";
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
		"Use reference photos for the SAME cookie identity, texture, colour and inclusions, but CHANGE the camera viewpoint as explicitly specified. The input camera angle must NOT be copied. Never substitute a different cookie. Imagine the unseen baked underside consistently when the requested camera is below the cookie.",
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
			const shotDirection = rotationViews[index].prompt;
			const framing = "Show one whole intact cookie. Leave at least 12% transparent margin on ALL four sides; no part of the cookie may touch or cross the image boundary.";
			const previousImages = JSON.parse(String(form.get("previousImages") || "[]")) as unknown;
			if (!Array.isArray(previousImages) || previousImages.length > 8 || previousImages.some((url) => typeof url !== "string")) throw new Error("Invalid previous frames.");
			const publicBase = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
			const previous = await Promise.all(previousImages.map(async (url: string) => {
				if (!publicBase || !url.startsWith(`${publicBase}/crumbie/products/`)) throw new Error("Previous frames must be stored in the product image bucket.");
				const response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(15_000) });
				if (!response.ok || Number(response.headers.get("content-length")) > MAX_IMAGE_BYTES) throw new Error("Previous frame unavailable.");
				const bytes = new Uint8Array(await response.arrayBuffer());
				if (bytes.length > MAX_IMAGE_BYTES) throw new Error("Previous frame too large.");
				return bytes;
			}));
			const deadline = Date.now() + 250_000;
			let feedback = "";
			let normalized: Buffer | undefined;
			for (let attempt = 0; attempt < 4; attempt++) {
				const upstream = new FormData();
				upstream.set("model", "gpt-image-2.5-sunburst");
				upstream.set("prompt", `${prompt} CAMERA REQUIREMENT TAKES PRIORITY: ${shotDirection} ${framing} ${feedback}`);
				upstream.set("quality", "medium"); upstream.set("size", "1024x1024");
				upstream.set("background", "transparent"); upstream.set("output_format", "png");
				// The accepted top frame anchors cookie identity for the remaining orbit.
				if (previous[1]) upstream.append("image[]", new Blob([previous[1]], { type: "image/png" }), "canonical-cookie.png");
				else references.forEach((file) => upstream.append("image[]", file, file.name));
				const remaining = deadline - Date.now();
				if (remaining < 20_000) break;
				const response = await fetch("https://api.openai.com/v1/images/edits", {
					method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: upstream, signal: AbortSignal.timeout(remaining),
				});
				const result = await response.json().catch(() => null);
				if (response.status === 429) {
					const seconds = Number(response.headers.get("retry-after")) || Number(result?.error?.message?.match(/try again in ([\d.]+)s/i)?.[1]) || 20;
					await new Promise((resolve) => setTimeout(resolve, Math.min(60, Math.max(1, seconds)) * 1000)); continue;
				}
				if (!response.ok || !result?.data?.[0]?.b64_json) throw new Error(result?.error?.message || "OpenAI did not return an image.");
				normalized = await normalizeProductImage(Buffer.from(result.data[0].b64_json, "base64"), index === 0 ? "cover" : "rotation");
				const issue = await rotationFrameIssue(normalized, index, index > 1 ? previous.slice(1) : []);
				if (!issue) break;
				console.warn("Rejected rotation image", rotationViews[index].label, issue);
				normalized = undefined; feedback = `The previous attempt was rejected: ${issue} Correct this viewpoint.`;
			}
			if (!normalized) throw new Error(`Could not generate a distinct ${rotationViews[index].label} view. Existing product images were preserved; please retry generation.`);
			return uploadMedia(
				`products/${productSlugFromName(name)}/generated-${timestamp}-${index + 1}.png`,
				normalized,
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
