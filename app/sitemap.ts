import type { MetadataRoute } from "next";
import { getProducts } from "@/lib/catalog-store";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
	const products = await getProducts().catch(() => []);
	const lastModified = new Date();
	return [
		"/",
		"/crumbs",
		...products.map((product) => `/crumbs/${product.slug}`),
		"/about",
		"/contact-us",
		"/ordering-policy",
		"/privacy-policy",
	].map((path) => ({ url: absoluteUrl(path), lastModified }));
}
