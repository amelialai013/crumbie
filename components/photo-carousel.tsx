"use client";

import Image from "next/image";
import PhotoLightbox from "@/components/photo-lightbox";
import { useCallback, useEffect, useRef, useState } from "react";

export default function PhotoCarousel({ images, name }: { images: string[]; name: string }) {
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const [open, setOpen] = useState<number | null>(null);

  const updateEdges = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 1, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 });
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    updateEdges();
    const observer = new ResizeObserver(updateEdges);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateEdges]);

  // Where the last programmatic scroll is headed. Reading scrollLeft mid-animation gives a stale
  // position (e.g. right after wrapping to the end), which made rapid clicks go the wrong way.
  const pending = useRef<number | null>(null);

  function scrollByPage(direction: -1 | 1) {
    const el = track.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const max = Math.max(0, el.scrollWidth - el.clientWidth);
    const first = el.firstElementChild as HTMLElement | null;
    const itemWidth = first ? first.offsetWidth + (parseFloat(getComputedStyle(el).columnGap) || 0) : el.clientWidth;
    const page = Math.max(1, Math.floor(el.clientWidth / itemWidth)) * itemWidth;
    const from = pending.current ?? el.scrollLeft;
    let target: number;
    if (direction === 1 && from >= max - 1) target = 0;
    else if (direction === -1 && from <= 1) target = max;
    else target = Math.min(max, Math.max(0, Math.round((from + direction * page) / itemWidth) * itemWidth));
    pending.current = target;
    el.scrollTo({ left: target, behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <div className="photo-carousel" role="region" aria-roledescription="carousel" aria-label={`${name} photos`}>
      <ul
        ref={track}
        onScroll={() => {
          updateEdges();
          const el = track.current;
          if (el && pending.current !== null && Math.abs(el.scrollLeft - pending.current) < 1) pending.current = null;
        }}
        onTouchStart={() => {
          pending.current = null;
        }}
        onPointerDown={() => {
          pending.current = null;
        }}
        onWheel={() => {
          pending.current = null;
        }}
      >
        {images.map((image, index) => (
          <li key={image}>
            <button type="button" className="photo-carousel-open" onClick={() => setOpen(index)} aria-label={`View ${name} photo ${index + 1} larger`}>
              <Image src={image} alt="" fill sizes="210px" unoptimized={!image.includes("images.unsplash.com")} />
            </button>
          </li>
        ))}
      </ul>
      <div className="photo-carousel-controls" hidden={edges.start && edges.end}>
        <button type="button" onClick={() => scrollByPage(-1)} aria-label="Previous photos">
          <svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="M10 3.5 5.5 8l4.5 4.5" /></svg>
        </button>
        <button type="button" onClick={() => scrollByPage(1)} aria-label="Next photos">
          <svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="m6 3.5 4.5 4.5L6 12.5" /></svg>
        </button>
      </div>
      <PhotoLightbox images={images} name={name} open={open} onOpenChange={setOpen} />
    </div>
  );
}
