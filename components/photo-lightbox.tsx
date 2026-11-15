"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef } from "react";

// Full-screen viewer shared by the photo carousels. `open` is the index being shown, or null when closed.
export default function PhotoLightbox({
  images,
  name,
  open,
  onOpenChange,
}: {
  images: string[];
  name: string;
  open: number | null;
  onOpenChange: (next: number | null) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open !== null && !el.open) el.showModal();
    if (open === null && el.open) el.close();
  }, [open]);

  const step = useCallback(
    (direction: -1 | 1) => {
      if (open !== null) onOpenChange((open + direction + images.length) % images.length);
    },
    [open, images.length, onOpenChange],
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
    <dialog
      ref={dialog}
      className="photo-lightbox"
      aria-label={`${name} photo viewer`}
      onClose={() => onOpenChange(null)}
      onKeyDown={onKeyDown}
      onClick={(event) => {
        if (event.target === event.currentTarget) onOpenChange(null);
      }}
      onTouchStart={(event) => {
        touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      }}
      onTouchEnd={onTouchEnd}
    >
      {open !== null && (
        <>
          <div className="photo-lightbox-stage" onClick={(event) => event.target === event.currentTarget && onOpenChange(null)}>
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
          <button type="button" className="photo-lightbox-close" onClick={() => onOpenChange(null)} aria-label="Close photo viewer" autoFocus>
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
  );
}
