"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

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
  const menuRef = useRef<HTMLUListElement>(null);
  const [floatingStyle, setFloatingStyle] = useState<CSSProperties | undefined>();
  const listId = `select-${useId().replace(/:/g, "")}`;
  const selected = options[selectedIndex];

  useEffect(() => {
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  // Inside a clipped, scrolling modal the menu is pinned to the viewport so it can overlap the footer.
  useEffect(() => {
    const root = rootRef.current;
    if (!open || !root?.closest(".admin-create-order")) {
      setFloatingStyle(undefined);
      return;
    }
    const place = () => {
      const rect = root.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - 16;
      const above = rect.top - 16;
      const openUp = below < 200 && above > below;
      setFloatingStyle({
        position: "fixed",
        left: rect.left,
        width: rect.width,
        maxHeight: Math.max(120, Math.min(320, openUp ? above : below)),
        overflowY: "auto",
        zIndex: 2000,
        background: "#1d1812",
        ...(openUp ? { top: "auto", bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6, bottom: "auto" }),
      });
    };
    place();
    window.addEventListener("resize", place);
    document.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", place, true);
    };
  }, [open]);

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

  const wrapMenu = (menu: React.ReactElement) => (floatingStyle ? createPortal(menu, document.body) : menu);

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
      {open && wrapMenu(
        <ul id={listId} ref={menuRef} className="premium-select-menu" style={floatingStyle} role="listbox" aria-labelledby={labelId}>
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
              <span className="premium-select-option-copy">
                <span>{option.label}</span>
                {option.detail && <small>{option.detail}</small>}
              </span>
              {option.value === value && <svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="m3.5 8 3 3 6-6" /></svg>}
            </li>
          ))}
        </ul>,
      )}
    </div>
  );
}
