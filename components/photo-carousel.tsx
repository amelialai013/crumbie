"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

export default function PhotoCarousel({ images, name }: { images: string[]; name: string }) {
  const track = useRef<HTMLUListElement>(null);

  const [edges, setEdges] = useState({ start: true, end: true });

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

  function scrollByPage(direction: -1 | 1) {
    const el = track.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <div className="photo-carousel" role="region" aria-roledescription="carousel" aria-label={`${name} photos`}>
      <div className="photo-carousel-controls">
        <button type="button" disabled={edges.start} onClick={() => scrollByPage(-1)} aria-label="Previous photos">
          <svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="M10 3.5 5.5 8l4.5 4.5" /></svg>
        </button>
        <button type="button" disabled={edges.end} onClick={() => scrollByPage(1)} aria-label="Next photos">
          <svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="m6 3.5 4.5 4.5L6 12.5" /></svg>
        </button>
      </div>
      <ul ref={track} tabIndex={0} onScroll={updateEdges}>
        {images.map((image, index) => (
          <li key={image}>
            <Image src={image} alt={`${name} photo ${index + 1}`} fill sizes="210px" unoptimized={!image.includes("images.unsplash.com")} />
          </li>
        ))}
      </ul>
    </div>
  );
}
