"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

export default function PhotoCarousel({ images, name }: { images: string[]; name: string }) {
  const track = useRef<HTMLUListElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
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

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open !== null && !el.open) el.showModal();
    if (open === null && el.open) el.close();
  }, [open]);

  function scrollByPage(direction: -1 | 1) {
    const el = track.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: reduce ? "auto" : "smooth" });
  }

  const step = useCallback(
    (direction: -1 | 1) => setOpen((current) => (current === null ? null : (current + direction + images.length) % images.length)),
    [images.length],
  );

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowLeft") step(-1);
    if (event.key === "ArrowRight") step(1);
  }

  function onTouchEnd(event: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start || images.length < 2) return;
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) step(dx < 0 ? 1 : -1);
  }

  return (
    <div className="photo-carousel" role="region" aria-roledescription="carousel" aria-label={`${name} photos`}>
      <div className="photo-carousel-controls" hidden={edges.start && edges.end}>
        <button type="button" disabled={edges.start} onClick={() => scrollByPage(-1)} aria-label="Previous photos">
          <svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="M10 3.5 5.5 8l4.5 4.5" /></svg>
        </button>
        <button type="button" disabled={edges.end} onClick={() => scrollByPage(1)} aria-label="Next photos">
          <svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="m6 3.5 4.5 4.5L6 12.5" /></svg>
        </button>
      </div>
      <ul ref={track} onScroll={updateEdges}>
        {images.map((image, index) => (
          <li key={image}>
            <button type="button" className="photo-carousel-open" onClick={() => setOpen(index)} aria-label={`View ${name} photo ${index + 1} larger`}>
              <Image src={image} alt="" fill sizes="210px" unoptimized={!image.includes("images.unsplash.com")} />
            </button>
          </li>
        ))}
      </ul>
      <dialog
        ref={dialog}
        className="photo-lightbox"
        aria-label={`${name} photo viewer`}
        onClose={() => setOpen(null)}
        onKeyDown={onKeyDown}
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(null);
        }}
        onTouchStart={(event) => {
          touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        }}
        onTouchEnd={onTouchEnd}
      >
        {open !== null && (
          <>
            <div className="photo-lightbox-stage" onClick={(event) => event.target === event.currentTarget && setOpen(null)}>
              <Image
                key={images[open]}
                src={images[open]}
                alt={`${name} photo ${open + 1}`}
                fill
                sizes="100vw"
                priority
                unoptimized={!images[open].includes("images.unsplash.com")}
              />
            </div>
            <button type="button" className="photo-lightbox-close" onClick={() => setOpen(null)} aria-label="Close photo viewer" autoFocus>
              <svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="M3.5 3.5l9 9m0-9-9 9" /></svg>
            </button>
            {images.length > 1 && (
              <>
                <button type="button" className="photo-lightbox-nav is-prev" onClick={() => step(-1)} aria-label="Previous photo">
                  <svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="M10 3.5 5.5 8l4.5 4.5" /></svg>
                </button>
                <button type="button" className="photo-lightbox-nav is-next" onClick={() => step(1)} aria-label="Next photo">
                  <svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="m6 3.5 4.5 4.5L6 12.5" /></svg>
                </button>
                <div className="photo-lightbox-count" aria-live="polite">
                  {open + 1} / {images.length}
                </div>
              </>
            )}
          </>
        )}
      </dialog>
    </div>
  );
}
