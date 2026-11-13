"use client";

import { motionDuration } from "@/lib/motion";

import RevealImage from "@/components/reveal-image";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import signatureCookie from "@/assets/cookies/choc-chip-cookie/turntable-premium/frame-01.png";
import biscoffCookie from "@/assets/cookies/biscoff-white-chocolate-cookie/turntable-clean/frame-03.png";
import { useCart } from "@/components/cart-context";
import QuantityControl from "@/components/quantity-control";
import { productSlugFromName } from "@/lib/catalog";
import type { CardOption } from "@/lib/card";

export default function CartView({ productImages, card }: { productImages: Record<string, string>; card: CardOption }) {
  const { lines, total: itemsTotal, ready, remove, setQuantity, clear, setLineCard } = useCart();
  const cardCount = card.enabled ? lines.reduce((sum, line) => sum + (line.cardMessages?.length ?? 0), 0) : 0;
  const withCard = cardCount > 0;
  const total = itemsTotal + cardCount * card.price;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [removingLastItem, setRemovingLastItem] = useState(false);
  const [emptyAppearing, setEmptyAppearing] = useState(false);
  const removeTimeoutRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (removeTimeoutRef.current !== null) window.clearTimeout(removeTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (!emptyAppearing || lines.length > 0) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [emptyAppearing, lines.length]);

  function removeLine(key: string) {
    if (removeTimeoutRef.current !== null) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      if (lines.length === 1) {
        setEmptyAppearing(true);
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      }
      remove(key);
      return;
    }
    setRemovingLastItem(lines.length === 1);
    setRemovingKey(key);
    removeTimeoutRef.current = window.setTimeout(() => {
      remove(key);
      setRemovingKey(null);
      setRemovingLastItem(false);
      if (lines.length === 1) {
        setEmptyAppearing(true);
      }
      removeTimeoutRef.current = null;
    }, motionDuration("panel", 460));
  }

  function removeAll() {
    if (removeTimeoutRef.current !== null) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setEmptyAppearing(true);
      clear();
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      return;
    }
    setRemovingLastItem(true);
    removeTimeoutRef.current = window.setTimeout(() => {
      clear();
      setRemovingLastItem(false);
      setEmptyAppearing(true);
      removeTimeoutRef.current = null;
    }, motionDuration("panel", 460));
  }

  async function checkout() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || typeof data.url !== "string") {
        setError(data.error || "Checkout could not be started.");
        return;
      }
      window.location.assign(data.url);
    } catch {
      setError("Checkout could not be started. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="page-hero"><div className="shell"><h1 className="page-title">Your order</h1></div></section>
      <section className="section cart-section">
        <div className="shell">
          {!ready ? null : lines.length === 0 ? (
            <div className={`cart-empty${emptyAppearing ? " is-appearing" : ""}`}>
              <h2>No crumbs left</h2>
              <Link className="btn btn-dark btn-arrow" href="/crumbs">
                Explore crumbs
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                  <path d="m7 4.5 5.5 5.5L7 15.5" />
                </svg>
              </Link>
            </div>
          ) : (
            <div className={`cart-layout${removingLastItem ? " is-last-removing" : ""}`}>
              <div className="cart-items">
                {lines.map((line) => {
                  const canonicalProductSlug = productSlugFromName(line.productName);
                  const lineCards = card.enabled ? line.cardMessages ?? [] : [];
                  return (
              <div key={line.key}>
              <div className={`cart-row${removingKey === line.key ? " is-removing" : ""}`}>
                <Link className="cart-product-link" href={`/crumbs/${canonicalProductSlug}`} aria-label={`View ${line.productName}`}>
                  <RevealImage
                    className="cart-product-image"
                    src={productImages[line.productId] || (line.productId === "product-seasonal" ? biscoffCookie : signatureCookie)}
                    unoptimized={Boolean(productImages[line.productId])}
                    alt={line.productName}
                    width={160}
                    height={160}
                    quality={100}
                    sizes="160px"
                  />
                </Link>
                <div className="cart-row-details">
                  <div className="cart-row-heading">
                    <h2><Link href={`/crumbs/${canonicalProductSlug}`}>{line.productName}</Link></h2>
                    <p className="cart-line-price">${(line.unitPrice * line.quantity).toFixed(2)} AUD</p>
                  </div>
                  <div className="cart-row-meta">
                    <p>{line.variantLabel}</p>
                    <p className="cart-row-pickup">
                      <span>{new Intl.DateTimeFormat("en-AU", { dateStyle: "full", timeZone: "Australia/Melbourne" }).format(new Date(`${line.pickupDate}T12:00:00+10:00`))}</span>
                      <span className="cart-row-meta-separator" aria-hidden="true"> · </span>
                      <span>{line.pickupWindow.replace(/\s*[–-]\s*/, " – ")}</span>
                    </p>
                  </div>
                </div>
                <div className="cart-row-actions">
                  <QuantityControl
                    value={line.quantity}
                    inputId={`quantity-${line.key}`}
                    inputAriaLabel={`Quantity for ${line.productName}`}
                    onChange={(value) => setQuantity(line.key, value)}
                  />
                  <button className="text-button" onClick={() => removeLine(line.key)} disabled={removingKey === line.key || removingLastItem}>
                    {removingKey === line.key ? "Removing…" : "Remove"}
                  </button>
                </div>
              </div>
              {lineCards.length > 0 && (
                <div className="cart-card-line">
                  <div className="cart-card-line-text">
                    <strong>{card.label} <span className="cart-card-for">for {line.productName}</span></strong>
                    <small>{lineCards.length} of {line.quantity} {line.quantity === 1 ? "box" : "boxes"} · ${card.price.toFixed(2)} each</small>
                    <ol className="cart-card-messages">
                      {lineCards.map((message, i) => (
                        <li key={i}>
                          <span>{lineCards.length === 1 ? "Message" : `Card ${i + 1}`}</span>
                          {message.trim() ? <q>{message.trim()}</q> : <em>Blank card</em>}
                        </li>
                      ))}
                    </ol>
                  </div>
                  <div className="cart-card-line-end">
                    <span>${(card.price * lineCards.length).toFixed(2)}</span>
                    <button className="text-button" onClick={() => setLineCard(line.key, [])} disabled={removingLastItem}>Remove</button>
                  </div>
                </div>
              )}
              </div>
                  );
                })}
                <button className="text-button cart-remove-all" onClick={removeAll} disabled={removingLastItem}>
                  <Trash2 aria-hidden="true" size={16} strokeWidth={1.75} />
                  {removingLastItem ? "Clearing…" : "Clear cart"}
                </button>
              </div>
              <aside className="summary cart-summary">
                <p className="cart-summary-heading">Order total</p>
                <h2>${total.toFixed(2)} <span>AUD</span></h2>
                {withCard && <p className="cart-summary-card">Includes {cardCount} Club Crumbie {cardCount === 1 ? "Card" : "Cards"} · ${(card.price * cardCount).toFixed(2)}</p>}
                <p>GST included. Pickup address provided in confirmation email.</p>
                <button className="btn btn-dark" disabled={busy} onClick={checkout}>{busy ? "Starting secure checkout…" : "Checkout"}</button>
                {error && <p className="field-error cart-checkout-error" role="alert">{error}</p>}
              </aside>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
