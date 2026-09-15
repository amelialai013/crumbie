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
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const { count } = useCart();
  const isActive = (href: string) => pathname === href || (href === "/cookies" && pathname.startsWith("/cookies/"));

  useEffect(() => {
    const updateHeader = () => setScrolled(window.scrollY > 8);
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => window.removeEventListener("scroll", updateHeader);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

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
  }, [open]);

  return (
    <header className={`site-header${pathname === "/" ? " home-header" : ""}${scrolled ? " scrolled" : ""}${open ? " menu-open" : ""}`}>
      <div className="nav-shell">
        <Link href="/" className="brand" onClick={() => setOpen(false)} aria-label="Crumbie home">
          <Image src={pictureLogoWhite} alt="Crumbie" priority sizes="52px" />
        </Link>
        <nav id="primary-navigation" className={open ? "nav-links open" : "nav-links"} aria-label="Primary navigation" aria-hidden={!open ? undefined : false}>
          {links.map(([label, href]) => (
            <Link key={href} href={href} onClick={() => setOpen(false)} className={isActive(href) ? "active" : ""} aria-current={isActive(href) ? "page" : undefined}>
              {label}
            </Link>
          ))}
          <Link href="/cart" onClick={() => setOpen(false)} className={`cart-link${pathname === "/cart" ? " active" : ""}`} aria-current={pathname === "/cart" ? "page" : undefined}>Cart <span>{count}</span></Link>
        </nav>
        <button type="button" className="menu-button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="primary-navigation">
          {open ? "Close" : "Menu"}
        </button>
      </div>
    </header>
  );
}
