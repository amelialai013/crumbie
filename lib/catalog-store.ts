import "server-only";
import { products as catalogProducts, pickupDates as catalogPickupDates, productSlugFromName, type PickupDate, type Product } from "@/lib/catalog";
import { cardOptionFrom, exploreCopyFrom, galleryCopyFrom, galleryImagesFrom, promoFrom, unavailableMessageFrom, type CardOption } from "@/lib/card";
import { deliveryFrom, type DeliveryOption } from "@/lib/delivery";
import { getRecord, listRecords } from "@/lib/store";

type ProductRecord = Product & { removed?: boolean };

/** Saved display order, with the promo (hero) product always first. */
function orderProducts(products: Product[], order: string[], heroId?: string) {
	const rank = new Map(order.map((id, index) => [id, index]));
	const sorted = products
		.map((product, index) => ({ product, index }))
		.sort((a, b) => (rank.get(a.product.id) ?? order.length) - (rank.get(b.product.id) ?? order.length) || a.index - b.index)
		.map((entry) => entry.product);
	const hero = sorted.find((product) => product.id === heroId);
	return hero ? [hero, ...sorted.filter((product) => product !== hero)] : sorted;
}

export async function getProductOrder(): Promise<string[]> {
	const record = await getRecord<{ ids?: string[] }>("content", "product-order");
	return Array.isArray(record?.ids) ? record.ids.filter((id): id is string => typeof id === "string") : [];
}

export async function getProducts(): Promise<Product[]> {
	const [stored, order, settings] = await Promise.all([
		listRecords<ProductRecord>("product"),
		getProductOrder(),
		getRecord<{ fields?: Record<string, string> }>("content", "settings"),
	]);
	const heroId = promoFrom(settings?.fields)?.productId;
	const products = new Map(catalogProducts.map((product) => [product.id, product]));
	stored.forEach((product) => {
		if (product.removed) products.delete(product.id);
		else products.set(product.id, product);
	});
	return orderProducts(Array.from(products.values()), order, heroId).map((product) => ({
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

export async function getDeliveryDates(): Promise<PickupDate[]> {
  const stored = await listRecords<PickupDate & { removed?: boolean }>("delivery-date");
  const dates = new Map<string, PickupDate>();
  for (const date of stored) {
    if (date.removed) dates.delete(date.id);
    else if (date.date) dates.set(date.id, date);
  }
  return Array.from(dates.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getDelivery(): Promise<DeliveryOption> {
  const [settings, dates] = await Promise.all([getRecord<{ fields?: Record<string, string> }>("content", "settings"), getDeliveryDates()]);
  return deliveryFrom(settings?.fields, dates);
}

export async function getGalleryCopy() {
  const settings = await getRecord<{ fields?: Record<string, string> }>("content", "settings");
  return galleryCopyFrom(settings?.fields);
}

export async function getGalleryImages() {
  const settings = await getRecord<{ fields?: Record<string, string> }>("content", "settings");
  return galleryImagesFrom(settings?.fields);
}

export async function getPromo() {
  const settings = await getRecord<{ fields?: Record<string, string> }>("content", "settings");
  return promoFrom(settings?.fields);
}

export async function getExploreCopy() {
  const settings = await getRecord<{ fields?: Record<string, string> }>("content", "settings");
  return exploreCopyFrom(settings?.fields);
}

export async function getUnavailableMessage() {
  const settings = await getRecord<{ fields?: Record<string, string> }>("content", "settings");
  return unavailableMessageFrom(settings?.fields);
}
