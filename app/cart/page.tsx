import { connection } from "next/server";
import CartView from "@/components/cart-view";
import { productSideProfile } from "@/lib/catalog";
import { getCardOption, getProducts, getPromo } from "@/lib/catalog-store";

export default async function Cart() {
  await connection();
  const [products, card, promo] = await Promise.all([getProducts(), getCardOption(), getPromo()]);
  const productImages = Object.fromEntries(
    products.flatMap((product) => {
      const image = productSideProfile(product);
      return image ? [[product.id, image]] : [];
    }),
  );
  return <CartView productImages={productImages} card={card} heroCard={promo ? { productId: promo.productId, label: promo.cardLabel } : null} />;
}
