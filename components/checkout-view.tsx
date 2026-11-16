"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/components/cart-context";
import type { CardOption } from "@/lib/card";
import { isDateClosed } from "@/lib/catalog";
import { formatPickupDate } from "@/lib/format-date";
import { deliveryFeeFor, postcodeAllowed, type DeliveryOption } from "@/lib/delivery";

type Mode = "pickup" | "delivery";
const empty = { name: "", street: "", suburb: "", postcode: "" };

export default function CheckoutView({ delivery, card }: { delivery: DeliveryOption; card: CardOption }) {
  const { lines, total: itemsTotal, ready } = useCart();
  const [chosenMode, setMode] = useState<Mode | null>(null);
  const mode: Mode = chosenMode ?? (lines.some((line) => line.fulfilment === "delivery") ? "delivery" : "pickup");
  const [form, setForm] = useState(empty);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (ready && lines.length === 0) window.location.replace("/cart");
  }, [ready, lines.length]);

  const cardCount = card.enabled ? lines.reduce((sum, line) => sum + (line.cardMessages?.length ?? 0), 0) : 0;
  const subtotal = itemsTotal + cardCount * card.price;
  const fee = mode === "delivery" ? deliveryFeeFor(delivery, subtotal) : delivery.pickupFee;
  const postcodeFilled = /^\d{4}$/.test(form.postcode.trim());
  const postcodeOk = postcodeAllowed(form.postcode, delivery.postcodes);
  const outOfRange = mode === "delivery" && postcodeFilled && !postcodeOk;
  const missing = mode === "delivery" && Object.values(form).some((value) => !value.trim());
  const blocked = mode === "delivery" && (missing || !postcodeOk);
  const total = blocked && mode === "delivery" ? subtotal : subtotal + fee;
  const set = (key: keyof typeof empty) => (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: event.target.value });
  const prettyDate = (date: string) => (/^\d{4}-\d{2}-\d{2}$/.test(date) ? formatPickupDate(date) : date);
  const deliveryLine = lines.find((line) => line.fulfilment === "delivery" && line.deliverySlot);
  const deliverySlots = deliveryLine?.deliverySlot ? [deliveryLine.deliverySlot] : delivery.slots.filter((slot) => !isDateClosed(slot)).slice(0, 1);
  const slots = mode === "delivery" && deliverySlots.length
    ? deliverySlots.map((slot) => ({ date: prettyDate(slot.date), window: slot.window }))
    : Array.from(new Map(lines.map((line) => [`${line.pickupDate}|${line.pickupWindow}`, { date: prettyDate(line.pickupDate), window: line.pickupWindow }])).values());
  const feeText = fee === 0 ? "Free" : `$${fee.toFixed(2)}`;

  async function pay() {
    setTouched(true);
    if (blocked) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines, fulfilment: mode, ...(mode === "delivery" && deliveryLine?.deliverySlot ? { deliverySlot: deliveryLine.deliverySlot } : {}), ...(mode === "delivery" ? { delivery: form } : {}) }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data.url !== "string") {
        setError(data.error || "Checkout could not be started.");
        setBusy(false);
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError("Checkout could not be started. Please check your connection and try again.");
      setBusy(false);
    }
  }

  if (!ready || lines.length === 0) return null;

  const check = <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M6 10.4l2.6 2.6L14 7.6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;

  return (
    <section className="section section-warm product-detail-section">
      <nav className="shell breadcrumb" aria-label="Breadcrumb">
        <Link href="/cart">Cart</Link>
        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
          <path d="m6 3.5 4.5 4.5L6 12.5" />
        </svg>
        <span aria-current="page">Checkout</span>
      </nav>
      <div className="shell">
        <div className="checkout-a">
          <h1 className="page-title">Checkout</h1>
          <div className="checkout-cols">
            <div className="checkout-form">
              <div className="fulfil-toggle" role="radiogroup" aria-label="Pickup or delivery">
                {(["pickup", "delivery"] as const).map((option) => (
                  <button key={option} type="button" role="radio" aria-checked={mode === option} className={mode === option ? "is-active" : ""} onClick={() => setMode(option)}>
                    <strong>{option === "pickup" ? delivery.pickupTitle : delivery.deliveryTitle}</strong>
                    <small>{option === "pickup" ? delivery.pickupDescription || (delivery.pickupFee === 0 ? "Free" : `$${delivery.pickupFee.toFixed(delivery.pickupFee % 1 ? 2 : 0)}`) : delivery.deliveryDescription || `${delivery.fee === 0 ? "Free" : `$${delivery.fee.toFixed(delivery.fee % 1 ? 2 : 0)}`}`}</small>
                  </button>
                ))}
              </div>

              {mode === "pickup" ? (
                <div className="checkout-pickup">
                  <span className="checkout-eyebrow" style={{ margin: 0 }}>Your pickup</span>
                  <h3>{slots.map((slot) => `${slot.date}, ${slot.window}`).join(" · ")}</h3>
                  <p className="checkout-muted">The pickup address is in your confirmation email. Want it delivered instead? Choose Delivery above.</p>
                </div>
              ) : (
                <div className="checkout-stack">
                  <div className={`field${touched && !form.name.trim() ? " has-error" : ""}`}>
                    <label htmlFor="delivery-name">Full name</label>
                    <input id="delivery-name" autoComplete="name" maxLength={80} placeholder="Name for the delivery" value={form.name} onChange={set("name")} />
                  </div>
                  <div className={`field${touched && !form.street.trim() ? " has-error" : ""}`}>
                    <label htmlFor="delivery-street">Street address</label>
                    <input id="delivery-street" autoComplete="address-line1" maxLength={120} value={form.street} onChange={set("street")} />
                  </div>
                  <div className="checkout-grid">
                    <div className={`field${touched && !form.suburb.trim() ? " has-error" : ""}`}>
                      <label htmlFor="delivery-suburb">Suburb</label>
                      <input id="delivery-suburb" autoComplete="address-level2" maxLength={60} value={form.suburb} onChange={set("suburb")} />
                    </div>
                    <div className="field">
                      <label htmlFor="delivery-state">State</label>
                      <input id="delivery-state" value="VIC" readOnly tabIndex={-1} />
                    </div>
                    <div className={`field${outOfRange || (touched && !postcodeOk) ? " has-error" : ""}`}>
                      <label htmlFor="delivery-postcode">Postcode</label>
                      <input id="delivery-postcode" inputMode="numeric" autoComplete="postal-code" maxLength={4} value={form.postcode} onChange={(event) => setForm({ ...form, postcode: event.target.value.replace(/\D/g, "") })} />
                    </div>
                  </div>
                  {postcodeOk && <p className="checkout-status" role="status">{check}<span>Great, we deliver to {form.suburb.trim() || form.postcode}.</span></p>}
                  {outOfRange && <p className="checkout-status is-error" role="alert">{check}<span>Sorry, we don&apos;t deliver to this postcode. Choose pickup instead.</span></p>}
                  <div className="checkout-slot">
                    <div>
                      <span>Delivery window</span>
                      {slots.map((slot) => (
                        <p key={`${slot.date}${slot.window}`}>{slot.date}{slot.window && <em> · {slot.window}</em>}</p>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <aside className="checkout-aside">
              <span className="checkout-eyebrow">Order summary</span>
              <div className="checkout-lines">
                {lines.map((line) => (
                  <div key={line.key} className="checkout-item">
                    {line.image ? <img className="checkout-thumb" src={line.image} alt="" /> : <i className="checkout-thumb" />}
                    <div>{line.quantity} × {line.productName}<small>{line.variantLabel} · {line.pickupDate}</small></div>
                    <span>${(line.unitPrice * line.quantity).toFixed(2)}</span>
                  </div>
                ))}
                {cardCount > 0 && (
                  <div className="checkout-item">
                    <i className="checkout-thumb" />
                    <div>{card.label}<small>{cardCount} × ${card.price.toFixed(2)}</small></div>
                    <span>${(cardCount * card.price).toFixed(2)}</span>
                  </div>
                )}
              </div>
              <div className="checkout-rows">
                <div className="checkout-row"><span>Subtotal</span><span>${subtotal.toFixed(2)}</span></div>
                <div className="checkout-row"><span>{mode === "delivery" ? "Delivery" : "Pickup"}</span><span>{mode === "delivery" && blocked ? "—" : feeText}</span></div>
                <div className="checkout-row is-total"><span>Total</span><span>${total.toFixed(2)} AUD</span></div>
              </div>
              <button className={`btn btn-dark${blocked ? " is-dim" : ""}`} disabled={busy} onClick={pay}>{busy ? "Starting secure checkout…" : "Pay now"}</button>
              {error && <p className="field-error" role="alert">{error}</p>}
              <p className="checkout-fine">You&apos;ll finish on Stripe&apos;s secure page · GST included</p>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}
