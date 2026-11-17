"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useCart, type CartLine } from "@/components/cart-context";
import QuantityControl from "@/components/quantity-control";
import type { CardOption } from "@/lib/card";
import { isDateClosed, productSlugFromName } from "@/lib/catalog";
import { formatPickupDate } from "@/lib/format-date";
import { deliveryFeeFor, postcodeAllowed, type DeliveryOption } from "@/lib/delivery";

type Mode = "pickup" | "delivery";
const empty = { name: "", street: "", suburb: "", postcode: "" };

export default function CheckoutView({ delivery, card }: { delivery: DeliveryOption; card: CardOption }) {
  const { lines, ready, remove, setQuantity, setLineCard } = useCart();
  const [form, setForm] = useState(empty);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{ placeId: string; text: string }>>([]);
  const [active, setActive] = useState(-1);
  const placesOff = useRef(false);
  const sessionToken = useRef("");
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  function searchAddress(value: string) {
    setForm((current) => ({ ...current, street: value }));
    clearTimeout(searchTimer.current);
    if (placesOff.current || value.trim().length < 3) return setSuggestions([]);
    searchTimer.current = setTimeout(async () => {
      sessionToken.current ||= crypto.randomUUID();
      try {
        const response = await fetch(`/api/places?token=${sessionToken.current}&input=${encodeURIComponent(value.trim())}`);
        if (response.status === 503) placesOff.current = true;
        const data = response.ok ? await response.json() : { suggestions: [] };
        setSuggestions(data.suggestions ?? []);
        setActive(-1);
      } catch {
        setSuggestions([]);
      }
    }, 250);
  }

  async function pickAddress(placeId: string, text: string) {
    setSuggestions([]);
    const token = sessionToken.current;
    sessionToken.current = "";
    setForm((current) => ({ ...current, street: text.split(",")[0] }));
    try {
      const response = await fetch(`/api/places?token=${token}&placeId=${encodeURIComponent(placeId)}`);
      if (!response.ok) return;
      const data = await response.json();
      setForm((current) => ({ ...current, street: data.street || current.street, suburb: data.suburb || current.suburb, postcode: /^\d{4}$/.test(data.postcode) ? data.postcode : current.postcode }));
    } catch {}
  }

  const prettyDate = (date: string) => (/^\d{4}-\d{2}-\d{2}$/.test(date) ? formatPickupDate(date) : date);
  const openSlot = delivery.slots.find((slot) => !isDateClosed(slot));
  const modeOf = (line: CartLine): Mode => line.fulfilment ?? "pickup";
  const whenOf = (line: CartLine, option: Mode) => (option === "delivery" ? line.deliverySlot ?? openSlot : { date: line.pickupDate, window: line.pickupWindow });
  const cardsOf = (line: CartLine) => (card.enabled ? line.cardMessages?.length ?? 0 : 0);
  const amountOf = (line: CartLine) => line.unitPrice * line.quantity + cardsOf(line) * card.price;

  const groupOf = (option: Mode) => {
    const group = lines.filter((line) => modeOf(line) === option);
    const sum = group.reduce((acc, line) => acc + amountOf(line), 0);
    const slots = new Map<string, { label: string; sort: string; lines: CartLine[] }>();
    for (const line of group) {
      const when = whenOf(line, option);
      const key = when ? `${when.date}|${when.window}` : "";
      const entry = slots.get(key) ?? { label: when ? `${prettyDate(when.date)}${when.window ? `, ${when.window}` : ""}` : "Date to be confirmed", sort: key, lines: [] };
      entry.lines.push(line);
      slots.set(key, entry);
    }
    const whens = Array.from(slots.values()).sort((x, y) => x.sort.localeCompare(y.sort));
    return { option, lines: group, sum, whens };
  };
  const groups = { pickup: groupOf("pickup"), delivery: groupOf("delivery") };
  const subtotal = groups.pickup.sum + groups.delivery.sum;
  const hasDelivery = groups.delivery.lines.length > 0;
  const pickupFee = groups.pickup.lines.length ? delivery.pickupFee : 0;
  const deliveryFee = hasDelivery ? deliveryFeeFor(delivery, groups.delivery.sum) : 0;
  const postcodeFilled = /^\d{4}$/.test(form.postcode.trim());
  const postcodeOk = postcodeAllowed(form.postcode, delivery.postcodes);
  const outOfRange = hasDelivery && postcodeFilled && !postcodeOk;
  const missing = hasDelivery && Object.values(form).some((value) => !value.trim());
  const blocked = hasDelivery && (missing || !postcodeOk);
  const total = subtotal + pickupFee + deliveryFee;
  const set = (key: keyof typeof empty) => (event: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: event.target.value });
  const money = (value: number) => (value === 0 ? "Free" : `$${value.toFixed(2)}`);
  const optionTitle = (option: Mode) => (option === "pickup" ? delivery.pickupTitle : delivery.deliveryTitle);

  async function pay() {
    setTouched(true);
    if (blocked) {
      const target = ["name", "street", "suburb", "postcode"].find((key) => key === "postcode" ? !postcodeOk : !form[key as keyof typeof form].trim());
      const input = target && document.getElementById(`delivery-${target}`);
      if (input) {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        input.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
        input.focus({ preventScroll: true });
      }
      return;
    }
    setBusy(true);
    setError("");
    const slot = hasDelivery ? whenOf(groups.delivery.lines[0], "delivery") : undefined;
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines,
          fulfilment: hasDelivery ? "delivery" : "pickup",
          ...(hasDelivery && slot ? { deliverySlot: slot } : {}),
          ...(hasDelivery ? { delivery: form } : {}),
        }),
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

  const deliveryForm = (
    <div className="checkout-stack">
      <div className={`field${touched && !form.name.trim() ? " has-error" : ""}`}>
        <label htmlFor="delivery-name">Full name</label>
        <input id="delivery-name" autoComplete="name" maxLength={80} placeholder="Name for the delivery" value={form.name} onChange={set("name")} />
        {touched && !form.name.trim() && <p className="field-error" role="alert">Enter full name</p>}
      </div>
      <div className={`field${touched && !form.street.trim() ? " has-error" : ""}`}>
        <label htmlFor="delivery-street">Street address</label>
        <div className="co-suggest">
          <input
            id="delivery-street"
            autoComplete="off"
            maxLength={120}
            role="combobox"
            aria-expanded={suggestions.length > 0}
            aria-controls="delivery-street-list"
            aria-autocomplete="list"
            value={form.street}
            onChange={(event) => searchAddress(event.target.value)}
            onBlur={() => setTimeout(() => setSuggestions([]), 150)}
            onKeyDown={(event) => {
              if (!suggestions.length) return;
              if (event.key === "ArrowDown") { event.preventDefault(); setActive((active + 1) % suggestions.length); }
              else if (event.key === "ArrowUp") { event.preventDefault(); setActive((active - 1 + suggestions.length) % suggestions.length); }
              else if (event.key === "Enter" && active >= 0) { event.preventDefault(); pickAddress(suggestions[active].placeId, suggestions[active].text); }
              else if (event.key === "Escape") setSuggestions([]);
            }}
          />
          {suggestions.length > 0 && (
            <ul id="delivery-street-list" role="listbox" className="co-suggest-list">
              {suggestions.map((item, index) => (
                <li key={item.placeId} role="option" aria-selected={index === active} className={index === active ? "is-active" : undefined} onMouseDown={(event) => { event.preventDefault(); pickAddress(item.placeId, item.text); }}>{item.text}</li>
              ))}
            </ul>
          )}
        </div>
        {touched && !form.street.trim() && <p className="field-error" role="alert">Enter street address</p>}
      </div>
      <div className="checkout-grid">
        <div className={`field${touched && !form.suburb.trim() ? " has-error" : ""}`}>
          <label htmlFor="delivery-suburb">Suburb</label>
          <input id="delivery-suburb" autoComplete="address-level2" maxLength={60} value={form.suburb} onChange={set("suburb")} />
        {touched && !form.suburb.trim() && <p className="field-error" role="alert">Enter suburb</p>}
        </div>
        <div className="field">
          <label htmlFor="delivery-state">State</label>
          <input id="delivery-state" value="VIC" readOnly tabIndex={-1} />
        </div>
        <div className={`field${outOfRange || (touched && !postcodeOk) ? " has-error" : ""}`}>
          <label htmlFor="delivery-postcode">Postcode</label>
          <input id="delivery-postcode" inputMode="numeric" autoComplete="postal-code" maxLength={4} value={form.postcode} onChange={(event) => setForm({ ...form, postcode: event.target.value.replace(/\D/g, "") })} />
        {touched && !postcodeOk && <p className="field-error" role="alert">{postcodeFilled ? "Sorry, we don't deliver to this postcode" : "Enter postcode"}</p>}
        </div>
      </div>
      {postcodeOk && <p className="checkout-status" role="status">{check}<span>Great, we deliver to {form.suburb.trim() || form.postcode}.</span></p>}
      {outOfRange && <p className="checkout-status is-error" role="alert">{check}<span>Sorry, we don&apos;t deliver to this postcode. Remove the delivery items to continue.</span></p>}
    </div>
  );

  const dateParts = (label: string) => {
    const i = label.lastIndexOf(", ");
    if (i < 0) return label;
    return <><span>{label.slice(0, i + 1)}</span> <span>{label.slice(i + 2)}</span></>;
  };
  const plural = (count: number) => `${count} ${count === 1 ? "order" : "orders"}`;

  const lineItem = (line: CartLine) => {
    const lineCards = card.enabled ? line.cardMessages ?? [] : [];
    const href = `/crumbs/${productSlugFromName(line.productName)}`;
    return (
      <li key={line.key} className="co-item-wrap">
        <div className="co-item">
          <Link href={href} aria-label={`View ${line.productName}`}>
            {line.image ? <img className="checkout-thumb" src={line.image} alt="" /> : <i className="checkout-thumb" />}
          </Link>
          <div className="co-item-body">
            <strong><Link href={href}>{line.productName}</Link></strong>
            <p className="co-price">${(line.unitPrice * line.quantity).toFixed(2)} AUD</p>
            <small>{line.variantLabel}</small>
            <button type="button" className="co-link co-remove" aria-label={`Remove ${line.productName}`} onClick={() => remove(line.key)}>Remove</button>
          </div>
          <div className="co-actions">
            <QuantityControl value={line.quantity} inputId={`quantity-${line.key}`} inputAriaLabel={`Quantity for ${line.productName}`} onChange={(value) => setQuantity(line.key, value)} />
          </div>
        </div>
        {lineCards.length > 0 && (
          <div className="co-card-line">
            <div>
              <strong>{card.label} × {lineCards.length}</strong>
              <p className="co-price">${(card.price * lineCards.length).toFixed(2)} AUD</p>
              {lineCards.map((message, i) => (
                <small key={i}>{[line.cardNames?.[i]?.trim(), message.trim() ? `“${message.trim()}”` : "Blank card"].filter(Boolean).join(": ")}</small>
              ))}
              <button type="button" className="co-link co-remove" onClick={() => setLineCard(line.key, [], [])}>Remove</button>
            </div>
          </div>
        )}
      </li>
    );
  };

  const totals = (
    <div className="co-totals">
      {(["pickup", "delivery"] as const).map((option) =>
        groups[option].lines.length > 0 ? (
          <p key={option}><span>{optionTitle(option)} · {plural(groups[option].lines.length)}</span><span>${groups[option].sum.toFixed(2)}</span></p>
        ) : null,
      )}
      {groups.pickup.lines.length > 0 && <p><span>Pickup fee</span><span>{money(pickupFee)}</span></p>}
      {hasDelivery && <p><span>Delivery fee</span><span>{money(deliveryFee)}</span></p>}
    </div>
  );

  const payRow = (
    <div className="co-pay-row">
      <div className="co-total" aria-live="polite">
        <span>Total (AUD)</span>
        <strong>${total.toFixed(2)}</strong>
      </div>
      <div className="co-pay-action">
        <button className="btn btn-dark co-pay" disabled={busy} onClick={pay}>{busy ? "Starting secure checkout…" : "Confirm and pay"}</button>
        {error && <p className="field-error" role="alert">{error}</p>}
        <p className="checkout-fine">You&apos;ll finish on Stripe&apos;s secure page · GST included</p>
      </div>
    </div>
  );

  const deliverPanel = hasDelivery && (
    <section className="co-deliver">
      <h2>Delivery information</h2>
      {deliveryForm}
    </section>
  );

  const original = (
    <div className="checkout-cols">
      <div className="co-stack">
        {(["pickup", "delivery"] as const).map((option) =>
          groups[option].lines.length > 0 ? (
            <section key={option} className="co-group">
              <div className="co-dates">
                {groups[option].whens.map((when) => (
                  <div key={when.sort} className="co-date">
                    <div className="co-group-head">
                      <div className="co-title">
                        <strong>{dateParts(when.label)}</strong>
                        <h2>{optionTitle(option)}</h2>
                      </div>
                    </div>
                    <ul className="co-items">{when.lines.map((line) => lineItem(line))}</ul>
                  </div>
                ))}
              </div>
            </section>
          ) : null,
        )}
        {deliverPanel}
      </div>
      <aside className="checkout-aside">
        <h2>Order summary</h2>
        {totals}
        {payRow}
      </aside>
    </div>
  );

  return (
    <>
      <section className="page-hero"><div className="shell"><h1 className="page-title">Your order</h1></div></section>
      <section className="section cart-section">
        <div className="shell">
          {!ready ? null : lines.length === 0 ? (
            <div className="cart-empty">
              <h2>No crumbs left</h2>
              <Link className="btn btn-dark btn-arrow" href="/crumbs">
                Explore crumbs
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                  <path d="m7 4.5 5.5 5.5L7 15.5" />
                </svg>
              </Link>
            </div>
          ) : (
            <div className="checkout-a">{original}</div>
          )}
        </div>
      </section>
    </>
  );
}
