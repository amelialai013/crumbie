"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

function Skeleton({ className }: { className: string }) {
  return <span className={`skeleton ${className}`} aria-hidden="true" />;
}

function AboutSkeleton() {
  return <div className="page-loader-content"><Skeleton className="skeleton-media" /><div className="page-loader-copy"><Skeleton className="skeleton-title" /><Skeleton className="skeleton-line" /><Skeleton className="skeleton-line skeleton-line-short" /><Skeleton className="skeleton-heading" /><Skeleton className="skeleton-line" /><Skeleton className="skeleton-button" /></div></div>;
}

function ContactSkeleton() {
  return <div className="page-loader-contact"><div className="page-loader-contact-intro"><Skeleton className="skeleton-contact-title" /><Skeleton className="skeleton-line" /><Skeleton className="skeleton-line skeleton-line-short" /></div><div className="page-loader-contact-form"><Skeleton className="skeleton-form-field" /><Skeleton className="skeleton-form-field" /><Skeleton className="skeleton-form-message" /><Skeleton className="skeleton-button" /></div></div>;
}

function CatalogSkeleton() {
  return <div className="page-loader-catalog"><Skeleton className="skeleton-catalog-title" /><div className="skeleton-catalog-grid"><Skeleton className="skeleton-catalog-card" /><Skeleton className="skeleton-catalog-card" /></div></div>;
}

function CartSkeleton() {
  return <div className="page-loader-cart"><div className="page-loader-cart-items"><Skeleton className="skeleton-cart-row" /><Skeleton className="skeleton-cart-row" /></div><div className="page-loader-cart-summary"><Skeleton className="skeleton-summary-line" /><Skeleton className="skeleton-summary-total" /><Skeleton className="skeleton-summary-button" /></div></div>;
}

function DetailSkeleton() {
  return <div className="page-loader-detail"><div className="page-loader-detail-copy"><Skeleton className="skeleton-detail-title" /><Skeleton className="skeleton-line" /><Skeleton className="skeleton-line skeleton-line-short" /><Skeleton className="skeleton-order" /></div><Skeleton className="skeleton-detail-media" /></div>;
}

export function RouteSkeleton() {
  const pathname = usePathname();

  return <div className="page-loader-shell" aria-hidden="true">
    <div className="page-loader-header">
      <span className="skeleton skeleton-logo" />
      <span className="skeleton skeleton-nav" />
    </div>
    {pathname === "/about" ? <AboutSkeleton /> : pathname === "/contact-us" ? <ContactSkeleton /> : pathname === "/cookies" ? <CatalogSkeleton /> : pathname === "/cart" ? <CartSkeleton /> : pathname.startsWith("/cookies/") ? <DetailSkeleton /> : <AboutSkeleton />}
  </div>;
}

export default function PageLoader() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (pathname !== "/") return;

    const minimumDisplayMs = 220;
    const exitDurationMs = 360;
    const loaderStartedAt = performance.now();
    let pageLoaded = document.readyState === "complete";
    let heroReady = false;
    let minimumDisplayTimeout: number | undefined;
    let hideTimeout: number | undefined;
    let isHiding = false;
    const hideLoader = () => {
      if (isHiding) return;
      isHiding = true;
      setExiting(true);
      hideTimeout = window.setTimeout(() => setVisible(false), exitDurationMs);
    };
    const dismiss = () => {
      if (!pageLoaded || !heroReady) return;
      const remaining = minimumDisplayMs - (performance.now() - loaderStartedAt);
      if (remaining > 0) {
        if (minimumDisplayTimeout === undefined) {
          minimumDisplayTimeout = window.setTimeout(hideLoader, remaining);
        }
        return;
      }
      hideLoader();
    };
    const handlePageLoad = () => {
      pageLoaded = true;
      dismiss();
    };
    const handleHeroReady = () => {
      heroReady = true;
      document.body.classList.add("home-hero-ready");
      dismiss();
    };
    document.body.classList.remove("home-hero-ready");
    const fallback = window.setTimeout(hideLoader, 5000);
    window.addEventListener("load", handlePageLoad, { once: true });
    window.addEventListener("hero-media-ready", handleHeroReady, { once: true });
    return () => {
      window.clearTimeout(fallback);
      if (minimumDisplayTimeout !== undefined) window.clearTimeout(minimumDisplayTimeout);
      if (hideTimeout !== undefined) window.clearTimeout(hideTimeout);
      document.body.classList.remove("home-hero-ready");
      window.removeEventListener("load", handlePageLoad);
      window.removeEventListener("hero-media-ready", handleHeroReady);
    };
  }, [pathname]);

  useEffect(() => {
    if (!visible || pathname !== "/") return;
    const previousOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [pathname, visible]);

  if (!visible || pathname !== "/") return null;

  return (
    <div className={`page-loader${exiting ? " is-closing" : ""}`} role="status" aria-label="Loading Club Crumbie" />
  );
}
