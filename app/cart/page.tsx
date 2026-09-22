"use client";

import { motionDuration } from "@/lib/motion";

import Image from "next/image";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import signatureCookie from "@/assets/cookies/choc-chip-cookie/turntable-clean/frame-01.png";
import biscoffCookie from "@/assets/cookies/biscoff-white-chocolate-cookie/turntable-clean/frame-03.png";
import { useCart } from "@/components/cart-context";
import QuantityControl from "@/components/quantity-control";

export default function Cart() {
  const { lines, total, ready, remove, setQuantity, clear } = useCart();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [removingLastItem, setRemovingLastItem] = useState(false);
  const [emptyAppearing, setEmptyAppearing] = useState(false);
  const removeTimeoutRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (removeTimeoutRef.current !== null) window.clearTimeout(removeTimeoutRef.current);
  }, []);

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
        window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
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
      window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
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
              <Link className="btn btn-dark btn-arrow" href="/cookies">
                Explore crumbs
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                  <path d="m7 4.5 5.5 5.5L7 15.5" />
                </svg>
              </Link>
            </div>
          ) : (
            <div className={`cart-layout${removingLastItem ? " is-last-removing" : ""}`}>
              <div className="cart-items">
                {lines.map((line) => (
              <div className={`cart-row${removingKey === line.key ? " is-removing" : ""}`} key={line.key}>
                <Link className="cart-product-link" href={`/cookies/${line.productSlug}`} aria-label={`View ${line.productName}`}>
                  <Image
                    className="cart-product-image"
                    src={line.productSlug === "seasonal-box" ? biscoffCookie : signatureCookie}
                    alt={line.productName}
                    width={160}
                    height={160}
                    sizes="(max-width: 640px) 96px, 160px"
                  />
                </Link>
                <div className="cart-row-details">
                  <div className="cart-row-heading">
                    <h2><Link href={`/cookies/${line.productSlug}`}>{line.productName}</Link></h2>
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
                ))}
                <button className="text-button cart-remove-all" onClick={removeAll} disabled={removingLastItem}>
                  <Trash2 aria-hidden="true" size={16} strokeWidth={1.75} />
                  {removingLastItem ? "Clearing…" : "Clear cart"}
                </button>
              </div>
              <aside className="summary cart-summary">
                <p className="cart-summary-heading">Order total</p>
                <h2>${total.toFixed(2)} <span>AUD</span></h2>
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
