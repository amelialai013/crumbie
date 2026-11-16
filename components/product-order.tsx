"use client";

import { motionDuration } from "@/lib/motion";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { isDateClosed, type PickupDate, type Product } from "@/lib/catalog";
import { formatPickupDate } from "@/lib/format-date";
import { deliveryFeeFor, type DeliveryOption } from "@/lib/delivery";
import type { CardOption } from "@/lib/card";
import { cardCountFor, useCart, type CardChoice } from "./cart-context";
import PremiumSelect from "./premium-select";
import QuantityControl from "./quantity-control";

export default function ProductOrder({ product, pickupDates, card, delivery }: { product: Product; pickupDates: PickupDate[]; card: CardOption; delivery: DeliveryOption }) {
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
  const [fulfilment, setFulfilment] = useState<"pickup" | "delivery">("pickup");
  const delivering = delivery.enabled && fulfilment === "delivery";
  const [slotId, setSlotId] = useState("");
  const slotOptions = delivery.slots.filter((slot) => !isDateClosed(slot));
  const chosenSlot = delivering ? slotOptions.find((slot) => slot.id === slotId) ?? slotOptions[0] : undefined;
  const [confirmation, setConfirmation] = useState<{ quantity: number; variant: string } | null>(null);
  const [confirmationClosing, setConfirmationClosing] = useState(false);
  const selectedVariant = product.variants.find((item) => item.id === variantId) ?? product.variants[0];
  const boxes = quantity || 1;
  const cardCount = card.enabled ? cardCountFor(cardSelected, boxes) : 0;
  const subtotal = selectedVariant.price * boxes + cardCount * card.price;
  const orderTotal = subtotal + (delivering ? deliveryFeeFor(delivery, subtotal) : delivery.pickupFee);
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
  useEffect(() => {
    const fit = () => {
      document.querySelectorAll<HTMLTextAreaElement>("textarea.card-addon-input").forEach((el) => {
        el.style.height = "auto";
        let needed = el.scrollHeight;
        if (el.placeholder) {
          // Always reserve room for the wrapped placeholder so the field keeps one height while typing.
          const style = getComputedStyle(el);
          const mirror = document.createElement("div");
          mirror.textContent = el.placeholder;
          mirror.style.cssText = `position:absolute;visibility:hidden;white-space:pre-wrap;overflow-wrap:break-word;box-sizing:border-box;width:${el.clientWidth}px;padding:${style.padding};font:${style.font};line-height:${style.lineHeight};letter-spacing:${style.letterSpacing}`;
          el.parentElement?.appendChild(mirror);
          needed = Math.max(needed, mirror.offsetHeight);
          mirror.remove();
        }
        el.style.height = `${needed + el.offsetHeight - el.clientHeight}px`;
      });
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [cardNames, cardCount]);
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
      fulfilment: delivering ? "delivery" : "pickup",
      ...(chosenSlot ? { deliverySlot: { date: chosenSlot.date, window: chosenSlot.window } } : {}),
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
        {delivery.enabled && (
          <div className="fulfil-toggle" role="radiogroup" aria-label="Pickup or delivery">
            {(["pickup", "delivery"] as const).map((option) => (
              <button key={option} type="button" role="radio" aria-checked={fulfilment === option} className={fulfilment === option ? "is-active" : ""} onClick={() => setFulfilment(option)}>
                <strong>{option === "pickup" ? delivery.pickupTitle : delivery.deliveryTitle}</strong>
                <small>{option === "pickup" ? delivery.pickupDescription || (delivery.pickupFee === 0 ? "Free" : `$${delivery.pickupFee.toFixed(delivery.pickupFee % 1 ? 2 : 0)}`) : delivery.deliveryDescription || `${delivery.fee === 0 ? "Free" : `$${delivery.fee.toFixed(delivery.fee % 1 ? 2 : 0)}`}`}</small>
              </button>
            ))}
          </div>
        )}
        <div className="field product-date">
          <span className="field-label" id="date-label">{delivering ? "Delivery date" : "Pickup date"}</span>
          {delivering ? (
            <PremiumSelect
              labelId="date-label"
              value={chosenSlot?.id ?? ""}
              options={slotOptions.map((slot) => ({ value: slot.id, label: formatPickupDate(slot.date), detail: slot.window }))}
              placeholder={slotOptions.length ? "Select a delivery date" : "No delivery dates currently available"}
              disabled={slotOptions.length === 0}
              onChange={setSlotId}
            />
          ) : (
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
          )}
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
              {card.description && <small>{card.description}</small>}
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
                        placeholder={card.namePlaceholder}
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
                          placeholder={card.messagePlaceholder}
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
        <button type="button" className="btn btn-dark" onClick={submit} disabled={soldOut || !dateId || (delivering && !chosenSlot)}>
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
