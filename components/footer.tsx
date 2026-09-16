import Image from "next/image";
import Link from "next/link";
import whiteLogo from "@/brand/logo/new-logo/full-white.png";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="shell footer-grid">
        <div>
          <Link href="/" className="footer-brand" aria-label="Club Crumbie home">
            <Image src={whiteLogo} alt="Club Crumbie" sizes="190px" />
          </Link>
        </div>
        <div>
          <Link href="/cookies">Crumbs</Link>
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
