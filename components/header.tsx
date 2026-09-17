"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import pictureLogoWhite from "@/brand/logo/crumbie-picturelogo-white.png";
import { useCart } from "./cart-context";

const links = [
  ["About", "/about"],
  ["Crumbs", "/cookies"],
  ["Contact us", "/contact-us"],
];

export default function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menuPathname, setMenuPathname] = useState(pathname);
  const [scrolled, setScrolled] = useState(false);
  const { count } = useCart();
  const menuVisible = open && menuPathname === pathname;
  const isActive = (href: string) => pathname === href || (href === "/cookies" && pathname.startsWith("/cookies/"));
  const handleHomeClick = () => {
    setOpen(false);
    if (pathname === "/") window.scrollTo({ top: 0, left: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };

  useEffect(() => {
    const updateHeader = () => setScrolled(window.scrollY > 8);
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => window.removeEventListener("scroll", updateHeader);
  }, [pathname]);

  useEffect(() => {
    const closeMenuOnNavigation = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || !event.target.closest("a[href]")) return;
      setOpen(false);
    };

    document.addEventListener("click", closeMenuOnNavigation);
    return () => document.removeEventListener("click", closeMenuOnNavigation);
  }, []);

  useEffect(() => {
    if (!menuVisible) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuVisible]);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 900px)");
    const closeMenuOnDesktop = (event: MediaQueryListEvent) => {
      if (!event.matches) setOpen(false);
    };

    mobileQuery.addEventListener("change", closeMenuOnDesktop);
    return () => mobileQuery.removeEventListener("change", closeMenuOnDesktop);
  }, []);

  useEffect(() => {
    // Crossing the mobile breakpoint flips the nav's opacity/position rules instantly; without this
    // it briefly transitions through those styles, flashing the hidden menu open and closed.
    let resizeTimeout: number | null = null;
    const handleResize = () => {
      document.documentElement.classList.add("is-resizing");
      if (resizeTimeout !== null) window.clearTimeout(resizeTimeout);
      resizeTimeout = window.setTimeout(() => {
        document.documentElement.classList.remove("is-resizing");
        resizeTimeout = null;
      }, 200);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeTimeout !== null) window.clearTimeout(resizeTimeout);
      document.documentElement.classList.remove("is-resizing");
    };
  }, []);

  return (
    <header className={`site-header${pathname === "/" ? " home-header" : ""}${scrolled ? " scrolled" : ""}${menuVisible ? " menu-open" : ""}`}>
      <div className="nav-shell">
        <Link href="/" className="brand" onClick={handleHomeClick} aria-label="Club Crumbie home">
          <Image src={pictureLogoWhite} alt="Club Crumbie" priority quality={100} sizes="52px" />
        </Link>
        <nav id="primary-navigation" className={menuVisible ? "nav-links open" : "nav-links"} aria-label="Primary navigation" aria-hidden={!menuVisible ? undefined : false}>
          {links.map(([label, href]) => (
            <Link key={href} href={href} className={isActive(href) ? "active" : ""} aria-current={isActive(href) ? "page" : undefined}>
              {label}
            </Link>
          ))}
          <Link href="/cart" className={`cart-link${pathname === "/cart" ? " active" : ""}`} aria-current={pathname === "/cart" ? "page" : undefined}>Cart <span>{count}</span></Link>
        </nav>
        <div className="nav-actions">
          <Link href="/cart" className="mobile-cart-link" aria-label={`Cart, ${count} item${count === 1 ? "" : "s"}`}>
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
              <path d="M4 6h12l-1 10a1.5 1.5 0 0 1-1.5 1.35h-7A1.5 1.5 0 0 1 5 16L4 6Z" />
              <path d="M7 6V5a3 3 0 0 1 6 0v1" />
            </svg>
            <span>{count}</span>
          </Link>
          <button type="button" className="menu-button" onClick={() => {
            if (open && menuPathname === pathname) {
              setOpen(false);
            } else {
              setMenuPathname(pathname);
              setOpen(true);
            }
          }} aria-expanded={menuVisible} aria-controls="primary-navigation">
            {menuVisible ? "Close" : "Menu"}
          </button>
        </div>
      </div>
    </header>
  );
}
