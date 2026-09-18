import "server-only";
import { products as catalogProducts, type Product } from "@/lib/catalog";
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
