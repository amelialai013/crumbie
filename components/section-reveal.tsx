"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Desktop: adds "is-visible" to the section once it is fully within the viewport, and the
 * matched items cascade in on a timer (see motion.css). Mobile: stacked layouts are often
 * taller than the viewport, so instead each item reveals on its own as it scrolls into view.
 */
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
        if (entry.intersectionRatio >= 1) {
          setVisible(true);
          sectionObserver.disconnect();
        }
      },
      { threshold: 1 }
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
      { threshold: 0.4 }
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
