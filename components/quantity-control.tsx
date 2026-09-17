"use client";

type QuantityValue = number | "";

export default function QuantityControl({
  value,
  inputId,
  inputAriaLabel,
  onChange,
}: {
  value: QuantityValue;
  inputId: string;
  inputAriaLabel?: string;
  onChange: (value: QuantityValue) => void;
}) {
  const currentValue = value || 1;

  return (
    <div className="field product-quantity">
      <label htmlFor={inputId}>Quantity</label>
      <div className="quantity-stepper">
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          value={value}
          aria-label={inputAriaLabel}
          onChange={(event) => {
            const nextValue = event.target.value.replace(/\D/g, "");
            onChange(nextValue === "" ? "" : Math.min(99, Math.max(1, Number(nextValue))));
          }}
          onBlur={() => {
            if (value === "") onChange(1);
          }}
        />
        <div className="quantity-stepper-controls">
          <button type="button" onClick={() => onChange(Math.max(1, currentValue - 1))} disabled={value === "" || value <= 1} aria-label="Decrease quantity">
            <svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="M3 8h10" /></svg>
          </button>
          <button type="button" onClick={() => onChange(Math.min(99, currentValue + 1))} disabled={value !== "" && value >= 99} aria-label="Increase quantity">
            <svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}
