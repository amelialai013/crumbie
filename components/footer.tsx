import Image from "next/image";
import Link from "next/link";
import whiteLogo from "@/brand/logo/crumbie-fulllogo-white.png";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="shell footer-grid">
        <div>
          <Link href="/" className="footer-brand" aria-label="Crumbie home">
            <Image src={whiteLogo} alt="Crumbie" sizes="190px" />
          </Link>
        </div>
        <div>
          <Link href="/cookies">Crumbs</Link>
          <Link href="/contact-us">Contact us</Link>
          <Link href="/ordering-policy">Ordering policy</Link>
        </div>
        <div>
          <p>Small-batch cookies made<br />for pickup in Ivanhoe, Victoria.</p>
        </div>
      </div>
      <div className="shell footer-bottom"><span>© {new Date().getFullYear()} Crumbie. All rights reserved.</span></div>
    </footer>
  );
}
