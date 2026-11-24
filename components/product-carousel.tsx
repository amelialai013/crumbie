"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export default function ProductCarousel({ children, title }: { children: ReactNode; title: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: true });

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    if (el.scrollLeft < 0) el.scrollLeft = 0;
    setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update]);

  const move = (direction: number) => {
    const el = track.current;
    const card = el?.firstElementChild as HTMLElement | null;
    if (!el || !card) return;
    el.scrollBy({ left: direction * (card.offsetWidth + 20), behavior: "smooth" });
  };

  const hasOverflow = !(edge.start && edge.end);

  return (
    <div className="product-carousel">
      <div className="product-carousel-head">
        <h2>{title}</h2>
        {hasOverflow && (
          <div className="product-carousel-arrows">
            <button type="button" aria-label="Previous crumbs" disabled={edge.start} onClick={() => move(-1)}>
              <svg aria-hidden="true" viewBox="0 0 16 16"><path d="M10 3.5 5.5 8l4.5 4.5" /></svg>
            </button>
            <button type="button" aria-label="Next crumbs" disabled={edge.end} onClick={() => move(1)}>
              <svg aria-hidden="true" viewBox="0 0 16 16"><path d="m6 3.5 4.5 4.5L6 12.5" /></svg>
            </button>
          </div>
        )}
      </div>
      <div className="product-carousel-track" ref={track} onScroll={update} onTouchEnd={() => window.setTimeout(update, 350)}>
        {children}
      </div>
    </div>
  );
}
