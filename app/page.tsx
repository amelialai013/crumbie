import Link from "next/link";
import Image from "next/image";
import { getProducts } from "@/lib/catalog-store";
import whiteLogo from "@/brand/logo/new-logo/text-white.png";
import whiteVerticalLogo from "@/assets/other/logo/white-vertical-logo-mobile.png";
import HeroMedia from "@/components/hero-media";
import ProductCookieImage from "@/components/product-cookie-image";
import SectionReveal from "@/components/section-reveal";

export default async function Home() {
  const products = await getProducts();
  return (
    <>
      <section className="hero">
        <HeroMedia />
        <div className="hero-content">
          <h1 className="hero-logo-heading">
            <Image className="hero-logo hero-logo-desktop" src={whiteLogo} alt="Club Crumbie" priority quality={100} sizes="640px" />
            <Image className="hero-logo hero-logo-mobile" src={whiteVerticalLogo} alt="Club Crumbie" priority unoptimized />
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

      <SectionReveal className="section how-it-works">
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
              <p>Choose an available pickup date and time in Ivanhoe, Victoria.</p>
            </div>
            <div className="step">
              <h3>Pay securely</h3>
              <p>Complete payment and receive immediate confirmation.</p>
            </div>
          </div>
          <div className="how-it-works-cta">
            <Link className="btn btn-dark btn-arrow" href="/cookies">
              Order now
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                <path d="m7 4.5 5.5 5.5L7 15.5" />
              </svg>
            </Link>
          </div>
        </div>
      </SectionReveal>

      <SectionReveal className="section section-warm cookie-catalog home-product-catalog" itemSelector=".product-card">
        <div className="shell">
          <div className="split-heading">
            <div><h2>Crumbs for<br />every craving</h2></div>
          </div>
          <div className="product-grid">
            {products.map((product) => (
              <Link className="product-card" href={`/cookies/${product.slug}`} key={product.id}>
                <div className="relative product-card-render">
                  <ProductCookieImage
                    image={product.imageMode === "gallery" ? product.images[0] : undefined}
                    name={product.name}
                    variant={product.id === "product-seasonal" ? "biscoff" : "signature"}
                  />
                </div>
                <div className="product-card-body">
                  <div className="product-card-heading">
                    <h2>{product.name}</h2>
                  </div>
                  <div className="product-card-footer">
                    <span className="price">Boxes from ${product.variants[0].price}</span>
                    <span className="product-card-action">
                      Order now
                      <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                        <path d="m7 4.5 5.5 5.5L7 15.5" />
                      </svg>
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </SectionReveal>
    </>
  );
}
