"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Desktop: adds "is-visible" to the section once enough of it is in view, and the matched
 * items cascade in on a timer (see motion.css). Mobile: stacked layouts are often taller than
 * the viewport, so instead each item reveals on its own as it scrolls into view.
 * Both trigger a little above the bottom edge so the motion plays where the reader is looking.
 */
const REVEAL_MARGIN = "0px 0px -12% 0px";
export default function SectionReveal({
  children,
  className,
  itemSelector = ".step",
}: {
  children: ReactNode;
  className?: string;
  itemSelector?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const section = ref.current;
    if (!section) return;

    const sectionObserver = new IntersectionObserver(
      ([entry]) => {
        // Reveal once 35% of the section is showing, or it fills most of a short viewport
        // (a section taller than the screen can never reach a high ratio).
        const rootHeight = entry.rootBounds?.height ?? window.innerHeight;
        if (entry.intersectionRatio >= 0.35 || entry.intersectionRect.height >= rootHeight * 0.5) {
          setVisible(true);
          sectionObserver.disconnect();
        }
      },
      { threshold: [0, 0.1, 0.2, 0.35, 0.5], rootMargin: REVEAL_MARGIN }
    );
    sectionObserver.observe(section);

    const items = section.querySelectorAll(itemSelector);
    const itemObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            itemObserver.unobserve(entry.target);
          }
        }
      },
      { threshold: 0, rootMargin: REVEAL_MARGIN }
    );
    items.forEach((item) => itemObserver.observe(item));

    return () => {
      sectionObserver.disconnect();
      itemObserver.disconnect();
    };
  }, [itemSelector]);

  return (
    <section ref={ref} className={`${className ?? ""} ${visible ? "is-visible" : ""}`.trim()}>
      {children}
    </section>
  );
}
