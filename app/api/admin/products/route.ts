import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/session";
import { getProducts } from "@/lib/catalog-store";
import { defaultProductAllergens, defaultProductIngredients } from "@/lib/catalog";
import { getRecord, saveRecord } from "@/lib/store";
import { uploadMedia } from "@/lib/r2";
import type { Product } from "@/lib/catalog";

function validProduct(value: unknown): value is Omit<Product, "images"> & { images?: string[] } {
	if (!value || typeof value !== "object") return false;
	const product = value as Partial<Product>;
	return typeof product.id === "string" && typeof product.slug === "string" && typeof product.name === "string" && typeof product.description === "string" && typeof product.ingredients === "string" && typeof product.allergens === "string" && Array.isArray(product.variants) && product.variants.every((variant) => variant && typeof variant.id === "string" && typeof variant.label === "string" && typeof variant.quantity === "number" && typeof variant.price === "number");
}

export async function GET() {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	return NextResponse.json(await getProducts());
}

export async function POST(request: Request) {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const form = await request.formData();
	const payload = JSON.parse(String(form.get("product") || "{}"));
	if (!validProduct(payload)) return NextResponse.json({ error: "Invalid product" }, { status: 400 });
	const existing = await getRecord<Product>("product", payload.id);
	const images = [...(Array.isArray(payload.images) ? payload.images : existing?.images || [])];
	try {
		for (const entry of form.getAll("images")) {
			if (entry instanceof File && entry.size > 0) {
				if (!entry.type.startsWith("image/") || entry.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Images must be under 10MB" }, { status: 400 });
				images.push(await uploadMedia(`products/${payload.slug}/${entry.name}`, new Uint8Array(await entry.arrayBuffer()), entry.type));
			}
		}
		const product: Product = {
			...payload,
			ingredients: payload.ingredients.trim() || defaultProductIngredients,
			allergens: payload.allergens.trim() || defaultProductAllergens,
			images,
		};
		await saveRecord("product", product);
		return NextResponse.json(product, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unable to save product";
		return NextResponse.json({ error: message }, { status: 503 });
	}
}

export async function DELETE(request: Request) {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const id = new URL(request.url).searchParams.get("id");
	if (!id) return NextResponse.json({ error: "Product id is required" }, { status: 400 });
	try {
		await saveRecord("product", { id, slug: "", name: "", description: "", ingredients: "", allergens: "", images: [], variants: [], removed: true } as Product & { removed: boolean });
		return NextResponse.json({ ok: true });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unable to remove product";
		return NextResponse.json({ error: message }, { status: 503 });
	}
}
