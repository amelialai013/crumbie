"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import logoText from "@/brand/latest-logos/new-text-logo/white-full-logo-text.png";
import logoPieceLeft from "@/brand/latest-logos/new-text-logo/white-full-logo-image-left.png";
import logoPieceRight from "@/brand/latest-logos/new-text-logo/white-full-logo-image-right.png";

export default function Footer() {
  const pathname = usePathname();

  function handleHomeClick() {
    if (pathname === "/") window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }

  return (
    <footer className="footer">
      <div className="shell footer-grid">
        <div>
          <Link
            href="/"
            className="footer-brand"
            onClick={handleHomeClick}
            aria-label="Club Crumbie home"
          >
            <span className="footer-logo" role="img" aria-label="Club Crumbie">
              <Image className="footer-logo-text" src={logoText} alt="" sizes="240px" quality={100} />
              <Image className="brand-piece brand-piece-left" src={logoPieceLeft} alt="" sizes="20px" quality={100} />
              <Image className="brand-piece brand-piece-right" src={logoPieceRight} alt="" sizes="20px" quality={100} />
            </span>
          </Link>
        </div>
        <div>
          <Link href="/crumbs">Crumbs</Link>
          <Link href="/contact-us">Contact us</Link>
          <Link href="/ordering-policy">Ordering policy</Link>
        </div>
        <div>
          <div className="footer-socials">
            <a href="https://instagram.com/clubcrumbie" target="_blank" rel="noopener noreferrer" aria-label="Club Crumbie on Instagram">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".6" /></svg>
            </a>
            <a href="https://tiktok.com/@clubcrumbie" target="_blank" rel="noopener noreferrer" aria-label="Club Crumbie on TikTok">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" /></svg>
            </a>
            <a href="https://facebook.com/clubcrumbie" target="_blank" rel="noopener noreferrer" aria-label="Club Crumbie on Facebook">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
            </a>
          </div>
        </div>
      </div>
      <div className="shell footer-bottom"><span>© {new Date().getFullYear()} Club Crumbie. All rights reserved.</span></div>
    </footer>
  );
}
