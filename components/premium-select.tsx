"use client";

import { useEffect, useId, useRef, useState } from "react";

type Option = { value: string; label: string; detail?: string };

export default function PremiumSelect({
  labelId,
  value,
  options,
  placeholder,
  disabled = false,
  onChange,
}: {
  labelId: string;
  value: string;
  options: Option[];
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const [highlightedIndex, setHighlightedIndex] = useState(Math.max(0, selectedIndex));
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = `select-${useId().replace(/:/g, "")}`;
  const selected = options[selectedIndex];

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  function select(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setHighlightedIndex(index);
    setOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      if (!open) {
        setOpen(true);
        setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
      } else {
        setHighlightedIndex((current) => (current + direction + options.length) % options.length);
      }
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && open) {
      event.preventDefault();
      select(highlightedIndex);
    }
  }

  return (
    <div className={`premium-select${open ? " open" : ""}`} ref={rootRef}>
      <button
        type="button"
        className="premium-select-trigger"
        aria-labelledby={labelId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => {
          setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
          setOpen((current) => !current);
        }}
        onKeyDown={handleKeyDown}
      >
        <span>{selected?.label ?? placeholder}</span>
        {selected?.detail && <small>{selected.detail}</small>}
        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="m4 6 4 4 4-4" /></svg>
      </button>
      {open && (
        <ul id={listId} className="premium-select-menu" role="listbox" aria-labelledby={labelId}>
          {options.map((option, index) => (
            <li
              id={`${listId}-${index}`}
              key={option.value}
              role="option"
              aria-selected={option.value === value}
              className={index === highlightedIndex ? "highlighted" : ""}
              onPointerEnter={() => setHighlightedIndex(index)}
              onClick={() => select(index)}
            >
              <span>{option.label}</span>
              {option.detail && <small>{option.detail}</small>}
              {option.value === value && <svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="m3.5 8 3 3 6-6" /></svg>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
