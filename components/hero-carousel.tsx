"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

const arrow = {
  prev: <path d="M10 3.5 5.5 8l4.5 4.5" />,
  next: <path d="m6 3.5 4.5 4.5L6 12.5" />,
};

export default function HeroCarousel({ images, name }: { images: string[]; name: string }) {
  const track = useRef<HTMLUListElement>(null);
  const pending = useRef<number | null>(null);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [index, setIndex] = useState(0);
  const count = images.length;

  const sync = useCallback(() => {
    const el = track.current;
    if (!el) return;
    const first = el.firstElementChild as HTMLElement | null;
    if (!first) return;
    const stride = first.offsetWidth + (parseFloat(getComputedStyle(el).columnGap) || 0);
    const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 1;
    const next = atEnd ? count - 1 : Math.min(count - 1, Math.max(0, Math.round(el.scrollLeft / stride)));
    setIndex(next);
    if (idle.current) clearTimeout(idle.current);
    idle.current = setTimeout(() => { pending.current = null; }, 150);
  }, [count]);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (idle.current) clearTimeout(idle.current);
    };
  }, [sync]);

  // Clicks read the last requested slide, not the live scroll position, so rapid presses keep their direction.
  function goTo(target: number) {
    const el = track.current;
    const slide = el?.children[target] as HTMLElement | undefined;
    if (!el || !slide) return;
    pending.current = target;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: slide.offsetLeft, behavior: reduce ? "auto" : "smooth" });
  }

  function step(direction: -1 | 1) {
    goTo((((pending.current ?? index) + direction) % count + count) % count);
  }

  function clearPending() {
    pending.current = null;
  }

  const controls = (className: string) => (
    <div className={className}>
      {(["prev", "next"] as const).map((dir) => (
        <button key={dir} type="button" onClick={() => step(dir === "prev" ? -1 : 1)} aria-label={dir === "prev" ? "Previous photo" : "Next photo"}>
          <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">{arrow[dir]}</svg>
        </button>
      ))}
    </div>
  );

  return (
    <div className="hero-carousel" role="region" aria-roledescription="carousel" aria-label={`${name} photos`}>
      <div className="hero-carousel-stage">
        <ul ref={track} onScroll={sync} onPointerDown={clearPending} onWheel={clearPending} onTouchStart={clearPending}>
          {images.map((image, i) => (
            <li key={image} aria-label={`Photo ${i + 1} of ${count}`}>
              <Image src={image} alt="" fill sizes="(max-width: 900px) 80vw, 640px" priority={i === 0} unoptimized={!image.includes("images.unsplash.com")} />
            </li>
          ))}
        </ul>
        {count > 1 && (
          <>
            {controls("hero-carousel-arrows")}
            <span className="hero-carousel-count" aria-live="polite">
              {index + 1} / {count}
            </span>
          </>
        )}
      </div>
      {count > 1 && (
        <>
          <div className="hero-carousel-thumbs">
            {images.map((image, i) => (
              <button key={image} type="button" className={i === index ? "is-active" : undefined} onClick={() => goTo(i)} aria-label={`Show photo ${i + 1}`} aria-current={i === index}>
                <Image src={image} alt="" fill sizes="120px" unoptimized={!image.includes("images.unsplash.com")} />
              </button>
            ))}
          </div>
          <div className="hero-carousel-foot">
            <div className="hero-carousel-dots" aria-hidden="true">
              {images.map((image, i) => (
                <i key={image} className={i === index ? "is-active" : undefined} />
              ))}
            </div>
            {controls("hero-carousel-buttons")}
          </div>
        </>
      )}
    </div>
  );
}
