import { connection } from "next/server";
import CartView from "@/components/cart-view";
import { productSideProfile } from "@/lib/catalog";
import { getCardOption, getProducts } from "@/lib/catalog-store";

export default async function Cart() {
  await connection();
  const [products, card] = await Promise.all([getProducts(), getCardOption()]);
  const productImages = Object.fromEntries(
    products.flatMap((product) => {
      const image = productSideProfile(product);
      return image ? [[product.id, image]] : [];
    }),
  );
  return <CartView productImages={productImages} card={card} />;
}
