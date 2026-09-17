"use client";

import { useLayoutEffect, useRef } from "react";

// Reveal content groups, never individual form controls or nested groups twice.
const GROUPS = [
  ".hero-content > *", ".page-hero .shell > *", ".split-heading", ".step",
  ".product-card", ".about-image", ".prose > *", ".enquiry-layout > *",
  ".product-detail-layout > *", ".product-facts > *", ".notice",
  ".cart-layout > *", ".cart-empty", ".admin-grid > *", ".form-card",
  ".section > .shell > .page-title", ".section > .shell > .lede",
].join(",");

export default function PageMotion({ children }: { children: React.ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const container = root.current;
    if (!container) return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const animations = new Map<Element, Animation>();
    const registered = new WeakSet<Element>();
    const style = getComputedStyle(container);
    const duration = parseFloat(style.getPropertyValue("--motion-reveal")) || 800;
    const stagger = parseFloat(style.getPropertyValue("--motion-stagger")) || 80;
    const easing = style.getPropertyValue("--motion-ease").trim() || "ease-out";
    const finish = (target: Element) => {
      animations.get(target)?.cancel();
      animations.delete(target);
    };
    const observer = new IntersectionObserver((entries) => {
      let index = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        const animation = animations.get(entry.target);
        if (!animation) continue;
        animation.effect?.updateTiming({ delay: Math.min(index++ * stagger, 180) });
        animation.play();
      }
    }, { rootMargin: "0px 0px -40px 0px", threshold: 0 });

    const register = () => {
      if (preference.matches) return;
      let index = 0;
      for (const target of container.querySelectorAll<HTMLElement>(GROUPS)) {
        if (registered.has(target) || target.parentElement?.closest(GROUPS)) continue;
        registered.add(target);
        const rect = target.getBoundingClientRect();
        // Back/forward restores already-read content without replaying it.
        if (rect.bottom <= 0 || !rect.height || target.contains(document.activeElement)) continue;
        const visible = rect.top < innerHeight - 40;
        const visual = target.matches(".product-card, .about-image, .cookie-explorer, .product-gallery");
        const heading = target.matches("h1, h2, .split-heading, .hero-logo-heading");
        const distance = visual ? 28 : heading ? 24 : 12;
        const startScale = visual ? "0.97" : "1";
        const animation = target.animate([
          { opacity: 0, translate: `0 ${distance}px`, scale: startScale },
          { opacity: 1, translate: "0 0", scale: "1" },
        ], { duration: visual ? duration + 160 : heading ? duration : duration * .75, easing, delay: visible ? Math.min(index++ * stagger, 180) : 0, fill: "both" });
        animations.set(target, animation);
        animation.onfinish = () => finish(target);
        if (!visible) {
          animation.pause();
          observer.observe(target);
        }
      }
      for (const target of animations.keys()) {
        if (!container.contains(target)) {
          observer.unobserve(target);
          finish(target);
        }
      }
    };
    const reset = () => {
      observer.disconnect();
      for (const target of animations.keys()) finish(target);
    };
    const onFocus = (event: FocusEvent) => {
      for (const target of animations.keys()) {
        if (target.contains(event.target as Node)) {
          observer.unobserve(target);
          finish(target);
        }
      }
    };
    register();
    // Streamed pages and hydrated cart panels can arrive after the template mounts.
    const mutations = new MutationObserver(register);
    mutations.observe(container, { childList: true, subtree: true });
    preference.addEventListener("change", reset);
    container.addEventListener("focusin", onFocus);
    return () => {
      mutations.disconnect();
      reset();
      preference.removeEventListener("change", reset);
      container.removeEventListener("focusin", onFocus);
    };
  }, []);

  return <div ref={root} className="page-transition">{children}</div>;
}
