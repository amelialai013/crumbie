import type { Metadata } from "next";
import { connection } from "next/server";
import CheckoutView from "@/components/checkout-view";
import { productCardImage } from "@/lib/catalog";
import { getCardOption, getDelivery, getProducts, getPromo } from "@/lib/catalog-store";

export const metadata: Metadata = { title: "Cart", robots: { index: false, follow: false } };

export default async function Cart() {
  await connection();
  const [delivery, card, products] = await Promise.all([getDelivery(), getCardOption(), getProducts()]);
  const promo = await getPromo();
  const images = Object.fromEntries(products.flatMap((product) => { const image = productCardImage(product) || product.images[0]; return image ? [[product.id, image]] : []; }));
  return <CheckoutView delivery={delivery} card={card} promo={promo} images={images} />;
}
