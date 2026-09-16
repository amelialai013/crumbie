import Link from "next/link";
import Image from "next/image";
import { products } from "@/lib/catalog";
import whiteLogo from "@/brand/logo/new-logo/text-white.png";
import HeroMedia from "@/components/hero-media";
import ProductCookieImage from "@/components/product-cookie-image";

export default function Home() {
  return (
    <>
      <section className="hero">
        <HeroMedia />
        <div className="hero-content">
          <h1 className="hero-logo-heading">
            <Image className="hero-logo" src={whiteLogo} alt="Club Crumbie" priority sizes="(max-width: 640px) 88vw, 640px" />
          </h1>
          <div className="actions">
            <Link className="btn btn-dark btn-arrow" href="/cookies">
              Explore crumbs
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                <path d="m7 4.5 5.5 5.5L7 15.5" />
              </svg>
            </Link>
            <Link className="btn btn-light" href="/contact-us">Make an enquiry</Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <div className="split-heading">
            <div><h2>How it works</h2></div>
          </div>
          <div className="steps">
            <div className="step">
              <h3>Choose your box</h3>
              <p>Pick a curated collection in a box of six or twelve.</p>
            </div>
            <div className="step">
              <h3>Select pickup</h3>
              <p>Choose an available Ivanhoe pickup date and time.</p>
            </div>
            <div className="step">
              <h3>Pay securely</h3>
              <p>Complete payment and receive immediate confirmation.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-warm cookie-catalog home-product-catalog">
        <div className="shell">
          <div className="split-heading">
            <div><h2>Crumbs for<br />every craving</h2></div>
          </div>
          <div className="product-grid">
            {products.map((product) => (
              <Link className="product-card" href={`/cookies/${product.slug}`} key={product.id}>
                <div className="relative product-card-render">
                  <ProductCookieImage
                    name={product.name}
                    variant={product.slug === "seasonal-box" ? "biscoff" : "signature"}
                  />
                </div>
                <div className="product-card-body">
                  <div className="product-card-heading">
                    <h2>{product.name}</h2>
                    <span className="product-card-action">
                      Order now
                      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                        <path d="m7 4.5 5.5 5.5L7 15.5" />
                      </svg>
                    </span>
                  </div>
                  <span className="price">From ${product.variants[0].price}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
