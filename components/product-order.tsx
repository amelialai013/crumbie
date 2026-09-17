"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { isDateClosed, pickupDates, type Product } from "@/lib/catalog";
import { useCart } from "./cart-context";
import PremiumSelect from "./premium-select";
import QuantityControl from "./quantity-control";

export default function ProductOrder({ product }: { product: Product }) {
  const { add } = useCart();
  const available = pickupDates
    .filter((date) => !isDateClosed(date) && !product.soldOutDates?.includes(date.id))
    .sort((a, b) => a.date.localeCompare(b.date));
  const [variantId, setVariantId] = useState(product.variants[0].id);
  const [dateId, setDateId] = useState(() => available[0]?.id ?? "");
  const [quantity, setQuantity] = useState<number | "">(1);
  const [confirmation, setConfirmation] = useState<{ quantity: number; variant: string } | null>(null);
  const [confirmationClosing, setConfirmationClosing] = useState(false);
  const selectedVariant = product.variants.find((item) => item.id === variantId) ?? product.variants[0];
  const orderTotal = selectedVariant.price * (quantity || 1);
  const soldOut = product.soldOut || available.length === 0;

  useEffect(() => {
    if (!confirmation || confirmationClosing) return;
    const timeoutId = window.setTimeout(() => setConfirmationClosing(true), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [confirmation, confirmationClosing]);

  function submit() {
    const date = pickupDates.find((item) => item.id === dateId);
    if (!date) return;
    const addedQuantity = quantity || 1;
    add({
      productId: product.id,
      productSlug: product.slug,
      productName: product.name,
      image: product.images[0],
      variantId: selectedVariant.id,
      variantLabel: selectedVariant.label,
      unitPrice: selectedVariant.price,
      quantity: addedQuantity,
      pickupDateId: date.id,
      pickupDate: date.date,
      pickupWindow: date.window,
    });
    setConfirmationClosing(false);
    setConfirmation({ quantity: addedQuantity, variant: selectedVariant.label });
  }

  return (
    <div className="product-order">
      <div className="product-order-heading">
        <h2>Order your box</h2>
      </div>
      <div className="product-order-fields">
        <div className="field">
          <span className="field-label" id="variant-label">Box size</span>
          <PremiumSelect
            labelId="variant-label"
            value={variantId}
            options={product.variants.map((item) => ({ value: item.id, label: item.label, detail: `$${item.price}` }))}
            placeholder="Select a box size"
            onChange={setVariantId}
          />
        </div>
        <QuantityControl value={quantity} inputId="quantity" onChange={setQuantity} />
        <div className="field product-date">
          <span className="field-label" id="date-label">Pickup date</span>
          <PremiumSelect
            labelId="date-label"
            value={dateId}
            options={available.map((date) => ({
              value: date.id,
              label: new Intl.DateTimeFormat("en-AU", { weekday: "long", day: "numeric", month: "long", timeZone: "Australia/Melbourne" }).format(new Date(`${date.date}T12:00:00+10:00`)),
              detail: date.window,
            }))}
            placeholder={soldOut ? "No dates currently available" : "Select an available date"}
            disabled={soldOut}
            onChange={setDateId}
          />
        </div>
      </div>
      <div className="product-order-total" aria-live="polite">
        <strong>${orderTotal} <span>AUD</span></strong>
        <button type="button" className="btn btn-dark" onClick={submit} disabled={soldOut || !dateId}>
          {soldOut ? "Sold out" : "Add to cart"}
        </button>
      </div>
      {confirmation && typeof document !== "undefined" && createPortal(
        <div
          className={`cart-confirmation${confirmationClosing ? " is-closing" : ""}`}
          role="status"
          aria-live="polite"
          onAnimationEnd={(event) => {
            if (event.animationName !== "cart-confirmation-out") return;
            setConfirmation(null);
            setConfirmationClosing(false);
          }}
        >
          <span className="cart-confirmation-check" aria-hidden="true">
            <svg viewBox="0 0 20 20"><path d="m4 10.5 3.5 3.5L16 6" /></svg>
          </span>
          <div>
            <strong>Added to your cart</strong>
            <p>{confirmation.quantity} × {confirmation.variant} · {product.name}</p>
          </div>
          <div className="cart-confirmation-actions">
            <a className="btn btn-dark" href="/cart">View cart</a>
            <button className="text-button" type="button" onClick={() => setConfirmationClosing(true)}>Close</button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
