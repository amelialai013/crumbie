"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * Marks each matched item "is-visible" the first time it scrolls into view; the entrance
 * itself lives in motion.css. Items reveal individually (a section is often taller than the
 * viewport), a little above the bottom edge so the motion plays where the reader is looking.
 */
const REVEAL_MARGIN = "0px 0px -10% 0px";

export default function SectionReveal({
  children,
  className,
  itemSelector = ".step, .how-it-works-cta",
}: {
  children: ReactNode;
  className?: string;
  itemSelector?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const section = ref.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // Items already scrolled past (anchor jumps, restored scroll) must never stay hidden.
          if (!entry.isIntersecting && entry.boundingClientRect.top > 0) continue;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: REVEAL_MARGIN },
    );
    const items = section.querySelectorAll<HTMLElement>(itemSelector);
    items.forEach((item) => {
      item.dataset.revealItem = "";
      observer.observe(item);
    });

    return () => {
      observer.disconnect();
      items.forEach((item) => delete item.dataset.revealItem);
    };
  }, [itemSelector]);

  return (
    <section ref={ref} className={className}>
      {children}
    </section>
  );
}
