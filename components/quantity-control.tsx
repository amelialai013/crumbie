"use client";

import { useState } from "react";

export default function QuantityControl({
  value,
  inputId,
  inputAriaLabel,
  min = 1,
  max = 99,
  label = "Quantity",
  tabIndex,
  onChange,
}: {
  value: number;
  inputId: string;
  inputAriaLabel?: string;
  min?: number;
  max?: number;
  label?: string | null;
  tabIndex?: number;
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
      {label && <label htmlFor={inputId}>{label}</label>}
      <div className="quantity-stepper">
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          value={draft}
          aria-label={inputAriaLabel}
          tabIndex={tabIndex}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "");
            setDraft(digits);
            if (digits === "") return;
            onChange(Math.min(max, Math.max(min, Number(digits))));
          }}
          onBlur={() => {
            if (draft === "") {
              setDraft(String(min));
              onChange(min);
            }
          }}
        />
        <div className="quantity-stepper-controls">
          <button type="button" tabIndex={tabIndex} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Decrease quantity">
            <svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="M3 8h10" /></svg>
          </button>
          <button type="button" tabIndex={tabIndex} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Increase quantity">
            <svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
