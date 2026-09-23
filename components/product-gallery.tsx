"use client";

import Image from "next/image";
import { useState } from "react";

export default function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [activeIndex, setActiveIndex] = useState(0);

  function moveSelection(direction: -1 | 1) {
    setActiveIndex((current) => (current + direction + images.length) % images.length);
  }

  return (
    <div className="product-gallery">
      <div className="product-gallery-main">
        <Image
          key={images[activeIndex]}
          className="product-gallery-image"
          src={images[activeIndex]}
          alt={`${name} — image ${activeIndex + 1}`}
          fill
          priority={activeIndex === 0}
          unoptimized={!images[activeIndex].includes("images.unsplash.com")}
          sizes="(max-width: 900px) 100vw, 56vw"
        />
        {images.length > 1 && (
          <div className="product-gallery-count" aria-live="polite">
            {String(activeIndex + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}
          </div>
        )}
      </div>
      {images.length > 1 && (
        <div
          className="product-gallery-thumbnails"
          role="group"
          aria-label={`${name} images`}
          onKeyDown={(event) => {
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            event.preventDefault();
            moveSelection(event.key === "ArrowLeft" ? -1 : 1);
          }}
        >
          {images.map((image, index) => (
            <button
              key={image}
              type="button"
              className={index === activeIndex ? "active" : ""}
              onClick={() => setActiveIndex(index)}
              aria-label={`Show image ${index + 1} of ${images.length}`}
              aria-pressed={index === activeIndex}
            >
              <Image
                src={image}
                alt=""
                fill
                sizes="88px"
                unoptimized={!image.includes("images.unsplash.com")}
              />
              <span>{String(index + 1).padStart(2, "0")}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
