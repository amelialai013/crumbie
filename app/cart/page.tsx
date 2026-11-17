import type { Metadata } from "next";
import { connection } from "next/server";
import CheckoutView from "@/components/checkout-view";
import { getCardOption, getDelivery } from "@/lib/catalog-store";

export const metadata: Metadata = { title: "Cart", robots: { index: false, follow: false } };

export default async function Cart() {
  await connection();
  const [delivery, card] = await Promise.all([getDelivery(), getCardOption()]);
  return <CheckoutView delivery={delivery} card={card} />;
}
