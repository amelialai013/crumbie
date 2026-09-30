"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

const TIMES = Array.from({ length: 96 }, (_, index) => {
  const hours = Math.floor(index / 4);
  const minutes = (index % 4) * 15;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
});

function formatTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const suffix = hours < 12 ? "AM" : "PM";
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${suffix}`;
}

const LIST_HEIGHT = 240;
const GAP = 6;

function listPosition(root: HTMLElement | null): React.CSSProperties {
  const anchor = root?.closest(".field") ?? root;
  if (!anchor) return {};
  const rect = anchor.getBoundingClientRect();
  const below = window.innerHeight - rect.bottom - GAP;
  const placeAbove = below < LIST_HEIGHT && rect.top > below;
  const maxHeight = Math.min(
    LIST_HEIGHT,
    (placeAbove ? rect.top : below) - GAP * 2,
  );
  return {
    left: rect.left,
    width: rect.width,
    maxHeight,
    ...(placeAbove
      ? { bottom: window.innerHeight - rect.top + GAP }
      : { top: rect.bottom + GAP }),
  };
}

type TimePickerProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
};

export function TimePicker({ id, label, value, onChange }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<React.CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    const selected =
      listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]') ??
      listRef.current?.querySelector<HTMLElement>('[data-time="09:00"]');
    const list = listRef.current;
    if (list && selected) {
      list.scrollTop =
        selected.offsetTop - list.clientHeight / 2 + selected.offsetHeight / 2;
    }
    selected?.focus({ preventScroll: true });

    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !rootRef.current?.contains(target) &&
        !listRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const dismiss = (event: Event) => {
      if (!listRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    window.addEventListener("scroll", dismiss, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("pointerdown", close);
      window.removeEventListener("scroll", dismiss, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [open]);

  const choose = (time: string) => {
    onChange(time);
    setOpen(false);
    rootRef.current?.querySelector<HTMLInputElement>("input")?.focus();
  };

  const handleListKey = (event: React.KeyboardEvent<HTMLUListElement>) => {
    const items = Array.from(
      listRef.current?.querySelectorAll<HTMLElement>("[role=option]") ?? [],
    );
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = items[index + (event.key === "ArrowDown" ? 1 : -1)];
      next?.focus({ preventScroll: false });
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      rootRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    } else if ((event.key === "Enter" || event.key === " ") && index >= 0) {
      event.preventDefault();
      choose(items[index].dataset.time!);
    }
  };

  return (
    <div className="time-picker" ref={rootRef}>
      <input
        id={id}
        type="time"
        step={300}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        className="time-picker-trigger"
        aria-label={`Choose ${label.toLowerCase()}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (!open) setPosition(listPosition(rootRef.current));
          setOpen((current) => !current);
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      </button>
      {open &&
        createPortal(
          <ul
            id={listId}
            ref={listRef}
            className="time-picker-list"
            style={position}
            role="listbox"
            aria-label={label}
            onKeyDown={handleListKey}
          >
            {TIMES.map((time) => (
              <li
                key={time}
                role="option"
                tabIndex={-1}
                data-time={time}
                aria-selected={time === value}
                onClick={() => choose(time)}
              >
                {formatTime(time)}
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
}
