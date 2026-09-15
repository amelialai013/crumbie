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

  useEffect(() => {
    const updateHeader = () => setScrolled(window.scrollY > 8);
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
    return () => window.removeEventListener("scroll", updateHeader);
  }, [pathname]);

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

  return (
    <header className={`site-header${pathname === "/" ? " home-header" : ""}${scrolled ? " scrolled" : ""}${menuVisible ? " menu-open" : ""}`}>
      <div className="nav-shell">
        <Link href="/" className="brand" onClick={() => setOpen(false)} aria-label="Crumbie home">
          <Image src={pictureLogoWhite} alt="Crumbie" priority sizes="52px" />
        </Link>
        <nav id="primary-navigation" className={menuVisible ? "nav-links open" : "nav-links"} aria-label="Primary navigation" aria-hidden={!menuVisible ? undefined : false}>
          {links.map(([label, href]) => (
            <Link key={href} href={href} className={isActive(href) ? "active" : ""} aria-current={isActive(href) ? "page" : undefined}>
              {label}
            </Link>
          ))}
          <Link href="/cart" className={`cart-link${pathname === "/cart" ? " active" : ""}`} aria-current={pathname === "/cart" ? "page" : undefined}>Cart <span>{count}</span></Link>
        </nav>
        <button type="button" className="menu-button" onClick={() => {
          if (open) {
            setOpen(false);
          } else {
            setMenuPathname(pathname);
            setOpen(true);
          }
        }} aria-expanded={menuVisible} aria-controls="primary-navigation">
          {menuVisible ? "Close" : "Menu"}
        </button>
      </div>
    </header>
  );
}
