"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Desktop: adds "is-visible" to the section once it is fully within the viewport, and the
 * steps cascade in on a timer (see motion.css). Mobile: the stacked layout is often taller
 * than the viewport, so instead each step reveals on its own as it scrolls into view.
 */
export default function SectionReveal({ children, className }: { children: ReactNode; className?: string }) {
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

    const steps = section.querySelectorAll(".step");
    const stepObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            stepObserver.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.4 }
    );
    steps.forEach((step) => stepObserver.observe(step));

    return () => {
      sectionObserver.disconnect();
      stepObserver.disconnect();
    };
  }, []);

  return (
    <section ref={ref} className={`${className ?? ""} ${visible ? "is-visible" : ""}`.trim()}>
      {children}
    </section>
  );
}
