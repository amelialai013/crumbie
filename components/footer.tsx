"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import logoText from "@/brand/latest-logos/new-text-logo/white-full-logo-text.png";
import logoPieceLeft from "@/brand/latest-logos/new-text-logo/white-full-logo-image-left.png";
import logoPieceRight from "@/brand/latest-logos/new-text-logo/white-full-logo-image-right.png";

export default function Footer() {
  const pathname = usePathname();
  const [logoPlaying, setLogoPlaying] = useState(false);

  function handleHomeClick() {
    if (pathname === "/") window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }

  return (
    <footer className="footer">
      <div className="shell footer-grid">
        <div>
          <Link
            href="/"
            className={`footer-brand${logoPlaying ? " is-playing" : ""}`}
            onClick={handleHomeClick}
            onPointerEnter={() => { setLogoPlaying(true); }}
            onFocus={() => { setLogoPlaying(true); }}
            onAnimationEnd={() => setLogoPlaying(false)}
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
          <p>Big crumb energy,<br />baked in small batches.</p>
        </div>
      </div>
      <div className="shell footer-bottom"><span>© {new Date().getFullYear()} Club Crumbie. All rights reserved.</span></div>
    </footer>
  );
}
