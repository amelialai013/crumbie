import "server-only";
import { products as catalogProducts, pickupDates as catalogPickupDates, type PickupDate, type Product } from "@/lib/catalog";
import { listRecords } from "@/lib/store";

type ProductRecord = Product & { removed?: boolean };

export async function getProducts(): Promise<Product[]> {
	const stored = await listRecords<ProductRecord>("product");
	const products = new Map(catalogProducts.map((product) => [product.id, product]));
	stored.forEach((product) => {
		if (product.removed) products.delete(product.id);
		else products.set(product.id, product);
	});
	return Array.from(products.values());
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
