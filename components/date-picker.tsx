"use client";

import { useRef, useState, type KeyboardEvent } from "react";

type Parts = { day: string; month: string; year: string };

function toParts(value: string): Parts {
  const [year = "", month = "", day = ""] = value.split("-");
  return { day, month, year };
}

function toIso({ day, month, year }: Parts) {
  if (day.length !== 2 || month.length !== 2 || year.length !== 4) return "";
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  const valid =
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day);
  return valid ? `${year}-${month}-${day}` : "";
}

export function DatePicker({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [parts, setParts] = useState<Parts>(() => toParts(value));
  const dayRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);
  const nativeRef = useRef<HTMLInputElement>(null);

  function update(next: Parts) {
    setParts(next);
    onChange(toIso(next));
  }

  function segment(key: keyof Parts, maxLength: number, next?: HTMLInputElement | null) {
    return (raw: string) => {
      const digits = raw.replace(/\D/g, "").slice(0, maxLength);
      update({ ...parts, [key]: digits });
      if (digits.length === maxLength) next?.focus();
    };
  }

  function padOnBlur(key: "day" | "month") {
    if (parts[key].length === 1 && parts[key] !== "0") {
      update({ ...parts, [key]: parts[key].padStart(2, "0") });
    }
  }

  function isBackspaceOnEmpty(event: KeyboardEvent<HTMLInputElement>) {
    return event.key === "Backspace" && !event.currentTarget.value;
  }

  return (
    <div className="time-picker date-picker">
      <div className="date-picker-segments" role="group" aria-label="Date (day, month, year)">
        <input
          id={id}
          ref={dayRef}
          inputMode="numeric"
          placeholder="DD"
          aria-label="Day"
          value={parts.day}
          onChange={(event) => segment("day", 2, monthRef.current)(event.target.value)}
          onBlur={() => padOnBlur("day")}
        />
        <span aria-hidden="true">/</span>
        <input
          ref={monthRef}
          inputMode="numeric"
          placeholder="MM"
          aria-label="Month"
          value={parts.month}
          onChange={(event) => segment("month", 2, yearRef.current)(event.target.value)}
          onBlur={() => padOnBlur("month")}
          onKeyDown={(event) => {
            if (isBackspaceOnEmpty(event)) dayRef.current?.focus();
          }}
        />
        <span aria-hidden="true">/</span>
        <input
          ref={yearRef}
          className="date-picker-year"
          inputMode="numeric"
          placeholder="YYYY"
          aria-label="Year"
          value={parts.year}
          onChange={(event) => segment("year", 4)(event.target.value)}
          onKeyDown={(event) => {
            if (isBackspaceOnEmpty(event)) monthRef.current?.focus();
          }}
        />
      </div>
      <input
        ref={nativeRef}
        className="date-picker-native"
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={toIso(parts)}
        onChange={(event) => update(toParts(event.target.value))}
      />
      <button
        type="button"
        className="time-picker-trigger"
        aria-label="Choose date"
        onClick={() => {
          try {
            nativeRef.current?.showPicker?.();
          } catch {
            dayRef.current?.focus();
          }
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="5" width="16" height="15" rx="2" />
          <path d="M4 10h16M8 3v4M16 3v4" />
        </svg>
      </button>
    </div>
  );
}
