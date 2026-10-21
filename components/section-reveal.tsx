"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * Marks each matched item "is-visible" the first time it scrolls into view; the entrance
 * itself lives in motion.css. Items reveal individually (a section is often taller than the
 * viewport), a little above the bottom edge so the motion plays where the reader is looking.
 */
const REVEAL_MARGIN = "0px 0px -32px 0px";
// Closing actions have no scroll moment of their own: they arrive with the last item before them.
const FOLLOWER_SELECTOR = ".how-it-works-cta, .prose > .btn";

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

  useLayoutEffect(() => {
    const section = ref.current;
    if (!section) return;

    const items = Array.from(section.querySelectorAll<HTMLElement>(itemSelector));
    const followers = Array.from(section.querySelectorAll<HTMLElement>(FOLLOWER_SELECTOR));
    const last = items[items.length - 1];

    const show = (item: HTMLElement) => item.classList.add("is-visible");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // Items already scrolled past (anchor jumps, restored scroll) must never stay hidden.
          if (!entry.isIntersecting && entry.boundingClientRect.top > 0) continue;
          show(entry.target as HTMLElement);
          observer.unobserve(entry.target);
          if (entry.target === last) followers.forEach(show);
        }
      },
      { rootMargin: REVEAL_MARGIN },
    );
    if (!last) followers.forEach(show);
    [...items, ...followers].forEach((item) => {
      item.dataset.revealItem = "";
    });
    items.forEach((item) => observer.observe(item));

    return () => {
      observer.disconnect();
      [...items, ...followers].forEach((item) => delete item.dataset.revealItem);
    };
  }, [itemSelector]);

  return (
    <section ref={ref} className={className}>
      {children}
    </section>
  );
}
