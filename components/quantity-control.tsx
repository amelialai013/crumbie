"use client";

import { useState } from "react";

export default function QuantityControl({
  value,
  inputId,
  inputAriaLabel,
  onChange,
}: {
  value: number;
  inputId: string;
  inputAriaLabel?: string;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const [lastValue, setLastValue] = useState(value);

  // Keep the field in sync when the quantity changes from outside (e.g. the stepper buttons).
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(String(value));
  }

  return (
    <div className="field product-quantity">
      <label htmlFor={inputId}>Quantity</label>
      <div className="quantity-stepper">
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          value={draft}
          aria-label={inputAriaLabel}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "");
            setDraft(digits);
            if (digits === "") return;
            onChange(Math.min(99, Math.max(1, Number(digits))));
          }}
          onBlur={() => {
            if (draft === "") {
              setDraft("1");
              onChange(1);
            }
          }}
        />
        <div className="quantity-stepper-controls">
          <button type="button" onClick={() => onChange(Math.max(1, value - 1))} disabled={value <= 1} aria-label="Decrease quantity">
            <svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="M3 8h10" /></svg>
          </button>
          <button type="button" onClick={() => onChange(Math.min(99, value + 1))} disabled={value >= 99} aria-label="Increase quantity">
            <svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
