import "server-only";
import { products as catalogProducts, pickupDates as catalogPickupDates, productSlugFromName, type PickupDate, type Product } from "@/lib/catalog";
import { cardOptionFrom, galleryCopyFrom, galleryImagesFrom, type CardOption } from "@/lib/card";
import { getRecord, listRecords } from "@/lib/store";

type ProductRecord = Product & { removed?: boolean };

export async function getProducts(): Promise<Product[]> {
	const stored = await listRecords<ProductRecord>("product");
	const products = new Map(catalogProducts.map((product) => [product.id, product]));
	stored.forEach((product) => {
		if (product.removed) products.delete(product.id);
		else products.set(product.id, product);
	});
	return Array.from(products.values()).map((product) => ({
		...product,
		slug: productSlugFromName(product.name),
		imageMode:
		  product.imageMode ||
		  (product.images.some(
		    (image) =>
		      image.startsWith("/uploads/") || !image.includes("images.unsplash.com"),
		  )
		    ? "gallery"
		    : undefined),
	}));
}

/** Shared by the storefront, admin and checkout so availability cannot diverge. */
export async function getPickupDates(): Promise<PickupDate[]> {
  const stored = await listRecords<PickupDate & { removed?: boolean }>("pickup-date");
  const dates = new Map(catalogPickupDates.map((date) => [date.id, date]));
  for (const date of stored) {
    if (date.removed) dates.delete(date.id);
    else if (date.date) dates.set(date.id, date);
  }
  return Array.from(dates.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getCardOption(): Promise<CardOption> {
  const settings = await getRecord<{ fields?: Record<string, string> }>("content", "settings");
  return cardOptionFrom(settings?.fields);
}

export async function getGalleryCopy() {
  const settings = await getRecord<{ fields?: Record<string, string> }>("content", "settings");
  return galleryCopyFrom(settings?.fields);
}

export async function getGalleryImages() {
  const settings = await getRecord<{ fields?: Record<string, string> }>("content", "settings");
  return galleryImagesFrom(settings?.fields);
}
