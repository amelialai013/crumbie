"use client";

import { useEffect } from "react";

/** Holds the hero entrance until its images are decoded, so nothing pops in mid-animation. */
export default function FeatureHeroGate({ targetId }: { targetId: string }) {
  useEffect(() => {
    const root = document.getElementById(targetId);
    if (!root) return;
    let done = false;
    const release = () => {
      if (done) return;
      done = true;
      root.dataset.gate = "ready";
    };
    const images = Array.from(root.querySelectorAll("img"));
    const timer = window.setTimeout(release, 1800);
    const fonts = document.fonts ? document.fonts.ready.then(() => undefined) : Promise.resolve();
    Promise.all([fonts, ...images.map((image) => image.decode().catch(() => undefined))]).then(() => {
      window.clearTimeout(timer);
      requestAnimationFrame(() => requestAnimationFrame(release));
    });
    return () => window.clearTimeout(timer);
  }, [targetId]);
  return null;
}
