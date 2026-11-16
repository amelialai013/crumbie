import type { Metadata } from "next";
import { connection } from "next/server";
import CartView from "@/components/cart-view";
import { productCardImage } from "@/lib/catalog";
import { getCardOption, getDelivery, getProducts, getPromo } from "@/lib/catalog-store";

export const metadata: Metadata = { title: "Cart", robots: { index: false, follow: false } };

export default async function Cart() {
  await connection();
  const [products, card, promo, delivery] = await Promise.all([getProducts(), getCardOption(), getPromo(), getDelivery()]);
  const productImages = Object.fromEntries(
    products.flatMap((product) => {
      const image = productCardImage(product);
      return image ? [[product.id, image]] : [];
    }),
  );
  return <CartView productImages={productImages} card={card} deliveryEnabled={delivery.enabled} heroCard={promo ? { productId: promo.productId, label: promo.cardLabel } : null} />;
}
