"use client";

import { motionDuration } from "@/lib/motion";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { isDateClosed, type PickupDate, type Product } from "@/lib/catalog";
import { formatPickupDate } from "@/lib/format-date";
import type { CardOption } from "@/lib/card";
import { cardCountFor, useCart, type CardChoice } from "./cart-context";
import PremiumSelect from "./premium-select";
import QuantityControl from "./quantity-control";

export default function ProductOrder({ product, pickupDates, card }: { product: Product; pickupDates: PickupDate[]; card: CardOption }) {
  const { add } = useCart();
  const [cardSelected, setCard] = useState<CardChoice>(0);
  const [cardMessages, setCardMessages] = useState<string[]>([]);
  const [cardNames, setCardNames] = useState<string[]>([]);
  const [showNameErrors, setShowNameErrors] = useState(false);
  const available = pickupDates
    .filter((date) => !isDateClosed(date) && !product.soldOutDates?.includes(date.id))
    .sort((a, b) => a.date.localeCompare(b.date));
  const [variantId, setVariantId] = useState(product.variants[0].id);
  const [dateId, setDateId] = useState(() => available[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [confirmation, setConfirmation] = useState<{ quantity: number; variant: string } | null>(null);
  const [confirmationClosing, setConfirmationClosing] = useState(false);
  const selectedVariant = product.variants.find((item) => item.id === variantId) ?? product.variants[0];
  const boxes = quantity || 1;
  const cardCount = card.enabled ? cardCountFor(cardSelected, boxes) : 0;
  const orderTotal = selectedVariant.price * boxes + cardCount * card.price;
  const updateMessage = (index: number, value: string) => {
    const next = Array.from({ length: Math.max(cardMessages.length, index + 1) }, (_, i) => cardMessages[i] ?? "");
    next[index] = value;
    setCardMessages(next);
  };
  const updateName = (index: number, value: string) => {
    const next = Array.from({ length: Math.max(cardNames.length, index + 1) }, (_, i) => cardNames[i] ?? "");
    next[index] = value;
    setCardNames(next);
  };
  const missingName = (index: number) => !(cardNames[index] ?? "").trim();
  const mode = cardCount === 0 ? "none" : cardCount >= boxes ? "all" : "some";
  const formatPrice = (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(2));
  const soldOut = product.soldOut || available.length === 0;

  useEffect(() => {
    if (!confirmation || confirmationClosing) return;
    const timeoutId = window.setTimeout(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        setConfirmation(null);
        setConfirmationClosing(false);
      } else {
        setConfirmationClosing(true);
      }
    }, 5000);
    return () => window.clearTimeout(timeoutId);
  }, [confirmation, confirmationClosing]);

  // Also dismiss if animations are disabled or motion preferences change mid-exit.
  useEffect(() => {
    if (!confirmationClosing) return;
    const timeout = window.setTimeout(() => {
      setConfirmation(null);
      setConfirmationClosing(false);
    }, motionDuration("exit", 320) + 40);
    return () => window.clearTimeout(timeout);
  }, [confirmationClosing]);

  function submit() {
    const date = pickupDates.find((item) => item.id === dateId);
    if (!date) return;
    if (Array.from({ length: cardCount }, (_, i) => i).some(missingName)) {
      setShowNameErrors(true);
      const first = Array.from({ length: cardCount }, (_, i) => i).find(missingName);
      document.getElementById(`card-name-${first}`)?.focus();
      return;
    }
    const addedQuantity = quantity;
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
      cardMessages: Array.from({ length: cardCount }, (_, i) => (cardMessages[i] ?? "").trim()),
      cardNames: Array.from({ length: cardCount }, (_, i) => (cardNames[i] ?? "").trim()),
    });
    setCard(0);
    setCardMessages([]);
    setCardNames([]);
    setShowNameErrors(false);
    setConfirmationClosing(false);
    setConfirmation({ quantity: addedQuantity, variant: selectedVariant.label });
  }

  function closeConfirmation() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setConfirmation(null);
      setConfirmationClosing(false);
      return;
    }
    setConfirmationClosing(true);
  }

  return (
    <div className="product-order">
      <div className="product-order-heading">
        <h2>Order your box</h2>
      </div>
      <div className="product-order-fields">
        <div className="field">
          <span className="field-label" id="variant-label">Size</span>
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
              label: formatPickupDate(date.date),
              detail: date.window,
            }))}
            placeholder={soldOut ? "No dates currently available" : "Select an available date"}
            disabled={soldOut}
            onChange={setDateId}
          />
        </div>
      </div>
      {card.enabled && (
        <div className={`card-addon${cardCount > 0 ? " is-on" : ""}`}>
          <button
            type="button"
            id="card-addon"
            role="switch"
            aria-checked={cardCount > 0}
            className="card-addon-toggle"
            onClick={() => setCard(cardCount > 0 ? 0 : "all")}
          >
            <span className="card-addon-text">
              <strong>{card.label}</strong>
              <small>{card.description}</small>
            </span>
            <span className="card-addon-meta">
              <em>{cardCount > 0 ? `+$${formatPrice(cardCount * card.price)}` : `+$${formatPrice(card.price)} each`}</em>
              <span className="card-addon-check" aria-hidden="true">
                <svg viewBox="0 0 20 20"><path d="m5 10.5 3.2 3.2L15 6.8" /></svg>
              </span>
            </span>
          </button>
          <div className={`card-addon-reveal${cardCount > 0 ? " is-open" : ""}`} aria-hidden={cardCount === 0}>
            <div>
              <div className="card-addon-options">
                {boxes > 1 && (
                  <>
                <p>{cardCount} of {boxes} boxes · ${formatPrice(card.price)} each</p>
                <div className="card-addon-seg" role="group" aria-label="Boxes with a card">
                  <button type="button" aria-pressed={mode === "all"} className={mode === "all" ? "is-on" : ""} onClick={() => setCard("all")}>Every box</button>
                  <button type="button" aria-pressed={mode === "some"} className={mode === "some" ? "is-on" : ""} onClick={() => setCard(mode === "some" ? cardCount : Math.max(1, Math.round(boxes / 2)))}>Some boxes</button>
                </div>
                  </>
                )}
                <div className={`card-addon-reveal${mode === "some" ? " is-open" : ""}`} aria-hidden={mode !== "some"}>
                  <div>
                    <div className="card-addon-step">
                      <button type="button" aria-label="Fewer cards" tabIndex={mode === "some" ? 0 : -1} disabled={cardCount <= 1} onClick={() => setCard(Math.max(1, cardCount - 1))}>−</button>
                      <input
                        inputMode="numeric"
                        aria-label="Number of cards"
                        tabIndex={mode === "some" ? 0 : -1}
                        value={cardCount}
                        onChange={(event) => setCard(Math.min(boxes - 1, Math.max(1, parseInt(event.target.value.replace(/\D/g, ""), 10) || 1)))}
                      />
                      <button type="button" aria-label="More cards" tabIndex={mode === "some" ? 0 : -1} disabled={cardCount >= boxes - 1} onClick={() => setCard(Math.min(boxes - 1, cardCount + 1))}>+</button>
                      <span>of {boxes} boxes</span>
                    </div>
                  </div>
                </div>
                <div className="card-addon-messages">
                  {Array.from({ length: cardCount }, (_, index) => (
                    <div className="card-addon-message" key={index}>
                      {cardCount > 1 && <label className="card-addon-message-title" htmlFor={`card-name-${index}`}>{`Card ${index + 1}`}</label>}
                      <textarea
                        id={`card-name-${index}`}
                        className={`card-addon-input${showNameErrors && missingName(index) ? " has-error" : ""}`}
                        rows={1}
                        maxLength={60}
                        autoComplete="off"
                        required
                        placeholder="Name (this will appear on the outside of the box)"
                        aria-label={cardCount === 1 ? "Card recipient name" : `Card ${index + 1} recipient name`}
                        aria-invalid={showNameErrors && missingName(index)}
                        value={cardNames[index] ?? ""}
                        onChange={(event) => updateName(index, event.target.value.replace(/\n/g, " "))}
                        onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}
                      />
                      {showNameErrors && missingName(index) && <small className="card-addon-error" role="alert">Please add a name for this card</small>}
                      <div className="card-addon-field">
                        <textarea
                          id={`card-message-${index}`}
                          rows={5}
                          maxLength={300}
                          aria-label={cardCount === 1 ? "Card message" : `Card ${index + 1} message`}
                          placeholder="Write a little something to go on your card (leave blank for a blank card)"
                          value={cardMessages[index] ?? ""}
                          onChange={(event) => updateMessage(index, event.target.value)}
                        />
                        <small className="card-addon-count">{(cardMessages[index] ?? "").length}/300</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="product-order-total" aria-live="polite">
        <strong>${Number.isInteger(orderTotal) ? orderTotal : orderTotal.toFixed(2)} <span>AUD</span></strong>
        <button type="button" className="btn btn-dark" onClick={submit} disabled={soldOut || !dateId}>
          {soldOut ? "Sold out" : "Add to cart"}
        </button>
      </div>
      {confirmation && typeof document !== "undefined" && createPortal(
        <div className="cart-toast-layer">
          <div className="cart-toast-backstop" aria-hidden="true" />
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
              <svg viewBox="0 0 20 20"><path d="m5 10.5 3.2 3.2L15 6.8" pathLength="1" /></svg>
            </span>
            <div className="cart-confirmation-text">
              <strong>
                <span className="cart-confirmation-full">Added to your cart</span>
                <span className="cart-confirmation-short">Added to cart</span>
              </strong>
              <p>{confirmation.quantity} × {confirmation.variant} · {product.name}</p>
            </div>
            <Link className="cart-confirmation-link" href="/cart">
              View cart
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4.5 5.5 5.5L7 15.5" /></svg>
            </Link>
            <button className="cart-confirmation-close" type="button" onClick={closeConfirmation} aria-label="Close">
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 5.5 9 9M14.5 5.5l-9 9" /></svg>
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
