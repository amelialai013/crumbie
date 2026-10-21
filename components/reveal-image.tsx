"use client";

import Image, { type ImageProps } from "next/image";
import { useLayoutEffect, useRef } from "react";

/**
 * Keeps its image invisible until the bytes are decoded, then marks the wrapper
 * `data-ready` so CSS fades it in once. The image never paints progressively. It works on
 * direct loads and on client-side navigations alike (inline scripts do not run on the latter).
 */
export default function RevealImage({ alt, ...props }: ImageProps) {
  const ref = useRef<HTMLImageElement>(null);

  useLayoutEffect(() => {
    const img = ref.current;
    const box = img?.parentElement;
    if (!img || !box) return;

    let cancelled = false;
    const ready = () => {
      if (cancelled) return;
      (img.decode ? img.decode() : Promise.resolve()).catch(() => undefined).then(() => {
        if (!cancelled) box.setAttribute("data-ready", "");
      });
    };
    const fail = () => !cancelled && box.setAttribute("data-ready", "");

    if (img.complete && img.naturalWidth > 0) ready();
    else {
      img.addEventListener("load", ready);
      img.addEventListener("error", fail);
    }
    const fallback = setTimeout(fail, 5000);

    return () => {
      cancelled = true;
      clearTimeout(fallback);
      img.removeEventListener("load", ready);
      img.removeEventListener("error", fail);
      box.removeAttribute("data-ready");
    };
  }, []);

  return <Image ref={ref} alt={alt} {...props} />;
}
