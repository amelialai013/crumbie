"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import whiteLogo from "@/brand/logo/new-logo/full-white.png";

export default function Footer() {
  const pathname = usePathname();

  function handleHomeClick() {
    if (pathname === "/") window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }

  return (
    <footer className="footer">
      <div className="shell footer-grid">
        <div>
          <Link href="/" className="footer-brand" onClick={handleHomeClick} aria-label="Club Crumbie home">
            <Image src={whiteLogo} alt="Club Crumbie" sizes="240px" quality={100} />
          </Link>
        </div>
        <div>
          <Link href="/crumbs">Crumbs</Link>
          <Link href="/contact-us">Contact us</Link>
          <Link href="/ordering-policy">Ordering policy</Link>
        </div>
        <div>
          <p>Big cookie energy,<br />baked in small batches.</p>
        </div>
      </div>
      <div className="shell footer-bottom"><span>© {new Date().getFullYear()} Club Crumbie. All rights reserved.</span></div>
    </footer>
  );
}
