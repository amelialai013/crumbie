"use client";

import { useState } from "react";
import PremiumSelect from "./premium-select";

type Variant = { id: string; label: string; price: number };
type ProductOption = { id: string; name: string; variants: Variant[] };
type DateOption = { id: string; date: string; window: string };
type Line = { productId: string; variantId: string; quantity: string; pickupDateId: string };

const emptyLine = (): Line => ({ productId: "", variantId: "", quantity: "1", pickupDateId: "" });
const money = (value: number) => `$${value.toFixed(2).replace(/\.00$/, "")}`;
const dateLabel = (item: DateOption) => `${item.date} · ${item.window}`;

export default function AdminCreateOrder({
  products,
  pickupDates,
  deliveryDates,
  onClose,
  onCreated,
}: {
  products: ProductOption[];
  pickupDates: DateOption[];
  deliveryDates: DateOption[];
  onClose: () => void;
  onCreated: (order: Record<string, unknown>) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [fulfilment, setFulfilment] = useState<"pickup" | "delivery">("pickup");
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [street, setStreet] = useState("");
  const [suburb, setSuburb] = useState("");
  const [postcode, setPostcode] = useState("");
  const [deliveryDateId, setDeliveryDateId] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const patchLine = (index: number, patch: Partial<Line>) =>
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  const subtotal = lines.reduce((sum, line) => {
    const variant = products.find((p) => p.id === line.productId)?.variants.find((v) => v.id === line.variantId);
    return sum + (variant ? variant.price * (Number(line.quantity) || 0) : 0);
  }, 0);
  const fee = fulfilment === "delivery" ? Number(deliveryFee) || 0 : 0;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setError("");
    if (!name.trim()) return setError("Add the customer's name");
    if (lines.some((line) => !line.productId || !line.variantId || !(Number(line.quantity) >= 1))) return setError("Choose a product, size and quantity for each item");
    if (fulfilment === "pickup" && lines.some((line) => !line.pickupDateId)) return setError("Choose a pickup date for each item");
    if (fulfilment === "delivery" && (!street.trim() || !suburb.trim() || !postcode.trim() || !deliveryDateId)) return setError("Add the delivery address and date");
    setSaving(true);
    const response = await fetch("/api/admin/orders/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        phone,
        notes,
        fulfilment,
        lines: lines.map((line) => ({
          productId: line.productId,
          variantId: line.variantId,
          quantity: Math.floor(Number(line.quantity)),
          pickupDateId: fulfilment === "pickup" ? line.pickupDateId : undefined,
        })),
        delivery: fulfilment === "delivery" ? { name, street, suburb, postcode } : undefined,
        deliveryDateId: fulfilment === "delivery" ? deliveryDateId : undefined,
        deliveryFee: fee,
      }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null);
    setSaving(false);
    if (!response?.ok || !result) return setError(result?.error || "Unable to create the order");
    onCreated(result);
  }

  return (
    <div className="admin-confirm-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
      <form className="admin-confirm-modal admin-order-modal admin-create-order" role="dialog" aria-modal="true" aria-labelledby="create-order-title" onSubmit={submit}>
        <div className="admin-order-head">
          <h2 id="create-order-title">Create order</h2>
          <button className="btn btn-light admin-order-close" type="button" aria-label="Close modal" title="Close" onClick={onClose} disabled={saving}>
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="m5 5 10 10M15 5 5 15" /></svg>
          </button>
        </div>
        <div className="admin-order-scroll">
        <p className="admin-create-order-note">Adds an order without taking payment. No emails are sent.</p>

        <div className="admin-create-order-grid">
          <div className="field">
            <label htmlFor="co-name">Name</label>
            <input id="co-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="co-email">Email (optional)</label>
            <input id="co-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="co-phone">Phone (optional)</label>
            <input id="co-phone" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="off" />
          </div>
          <div className="field">
            <label id="co-fulfilment-label">Collection</label>
            <PremiumSelect
              labelId="co-fulfilment-label"
              value={fulfilment}
              options={[{ value: "pickup", label: "Pickup" }, { value: "delivery", label: "Delivery" }]}
              placeholder="Collection"
              onChange={(value) => setFulfilment(value as "pickup" | "delivery")}
            />
          </div>
        </div>

        <div className="admin-create-order-items">
          {lines.map((line, index) => {
            const product = products.find((p) => p.id === line.productId);
            return (
              <div className="admin-create-order-line" key={index}>
                <div className="field">
                  <label id={`co-product-${index}`}>Product</label>
                  <PremiumSelect
                    labelId={`co-product-${index}`}
                    value={line.productId}
                    options={products.map((p) => ({ value: p.id, label: p.name }))}
                    placeholder="Choose a product"
                    onChange={(value) => patchLine(index, { productId: value, variantId: "" })}
                  />
                </div>
                <div className="field">
                  <label id={`co-variant-${index}`}>Size</label>
                  <PremiumSelect
                    labelId={`co-variant-${index}`}
                    value={line.variantId}
                    disabled={!product}
                    options={(product?.variants ?? []).map((v) => ({ value: v.id, label: `${v.label} · ${money(v.price)}` }))}
                    placeholder="Choose a size"
                    onChange={(value) => patchLine(index, { variantId: value })}
                  />
                </div>
                <div className="field admin-create-order-qty">
                  <label htmlFor={`co-qty-${index}`}>Qty</label>
                  <input id={`co-qty-${index}`} type="number" min={1} max={100} value={line.quantity} onChange={(e) => patchLine(index, { quantity: e.target.value })} />
                </div>
                {fulfilment === "pickup" && (
                  <div className="field admin-create-order-date">
                    <label id={`co-pickup-${index}`}>Pickup date</label>
                    <PremiumSelect
                      labelId={`co-pickup-${index}`}
                      value={line.pickupDateId}
                      options={pickupDates.map((d) => ({ value: d.id, label: dateLabel(d) }))}
                      placeholder="Choose a pickup date"
                      onChange={(value) => patchLine(index, { pickupDateId: value })}
                    />
                  </div>
                )}
                {lines.length > 1 && (
                  <button type="button" className="admin-text-button admin-create-order-remove" onClick={() => setLines((current) => current.filter((_, i) => i !== index))}>
                    Remove
                  </button>
                )}
              </div>
            );
          })}
          <button type="button" className="admin-text-button" onClick={() => setLines((current) => [...current, emptyLine()])}>
            Add another item
          </button>
        </div>

        {fulfilment === "delivery" && (
          <div className="admin-create-order-grid">
            <div className="field admin-create-order-wide">
              <label htmlFor="co-street">Street address</label>
              <input id="co-street" value={street} onChange={(e) => setStreet(e.target.value)} autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor="co-suburb">Suburb</label>
              <input id="co-suburb" value={suburb} onChange={(e) => setSuburb(e.target.value)} autoComplete="off" />
            </div>
            <div className="field">
              <label htmlFor="co-postcode">Postcode</label>
              <input id="co-postcode" inputMode="numeric" value={postcode} onChange={(e) => setPostcode(e.target.value)} autoComplete="off" />
            </div>
            <div className="field">
              <label id="co-delivery-date-label">Delivery date</label>
              <PremiumSelect
                labelId="co-delivery-date-label"
                value={deliveryDateId}
                options={deliveryDates.map((d) => ({ value: d.id, label: dateLabel(d) }))}
                placeholder="Choose a delivery date"
                onChange={setDeliveryDateId}
              />
            </div>
            <div className="field">
              <label htmlFor="co-fee">Delivery fee ($)</label>
              <input id="co-fee" type="number" min={0} step="0.01" value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} />
            </div>
          </div>
        )}

        <div className="field admin-create-order-notes">
          <label htmlFor="co-notes">Notes (optional)</label>
          <textarea id="co-notes" rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {error && <p className="admin-reply-error" role="alert">{error}</p>}
        </div>
        <div className="admin-confirm-actions admin-create-order-footer">
          <span className="admin-create-order-total">Total {money(subtotal + fee)}</span>
          <button className="btn btn-light" type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button className={`btn btn-dark${saving ? " btn-loading" : ""}`} type="submit" disabled={saving}>{saving && <span className="btn-spinner" aria-hidden="true" />}Create order</button>
        </div>
      </form>
    </div>
  );
}
