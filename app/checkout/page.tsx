import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import CheckoutView from "@/components/checkout-view";
import { getCardOption, getDelivery } from "@/lib/catalog-store";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

export default async function Checkout() {
  await connection();
  const [delivery, card] = await Promise.all([getDelivery(), getCardOption()]);
  if (!delivery.enabled) redirect("/cart");
  return <CheckoutView delivery={delivery} card={card} />;
}
