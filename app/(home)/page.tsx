import { productSideProfile } from "@/lib/catalog";
import Link from "next/link";
import Image from "next/image";
import { getProducts } from "@/lib/catalog-store";
import whiteLogo from "@/brand/latest-logos/new-text-logo/text-white.png";
import whiteVerticalLogo from "@/brand/latest-logos/new-text-logo/white-vertical-logo.png";
import HeroMedia from "@/components/hero-media";
import ProductCookieImage from "@/components/product-cookie-image";
import SectionReveal from "@/components/section-reveal";
import { getRecord } from "@/lib/store";

export default async function Home() {
  const products = await getProducts();
  const content = await getRecord<{ fields?: Record<string, string> }>("content", "homepage").catch(() => null);
  const f = content?.fields || {};
  const catalogHeading = f.catalogHeading && f.catalogHeading !== "Crumbs for every craving" ? f.catalogHeading : null;
  return (
    <>
      <section className="hero">
        <HeroMedia />
        <div className="hero-content">
          <h1 className="hero-logo-heading">
            <Image className="hero-logo hero-logo-desktop" src={whiteLogo} alt="Club Crumbie" preload quality={100} sizes="640px" />
            <Image className="hero-logo hero-logo-mobile" src={whiteVerticalLogo} alt="Club Crumbie" preload quality={100} sizes="340px" />
          </h1>
          <div className="actions">
            <Link className="btn btn-dark btn-arrow" href="/crumbs">
              {f.heroPrimaryLabel || "Explore crumbs"}
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                <path d="m7 4.5 5.5 5.5L7 15.5" />
              </svg>
            </Link>
            <Link className="btn btn-light" href="/contact-us">{f.heroSecondaryLabel || "Make an enquiry"}</Link>
          </div>
        </div>
      </section>

      <SectionReveal className="section how-it-works">
        <div className="shell">
          <div className="split-heading">
            <div><h2>{f.howTitle || "How it works"}</h2></div>
          </div>
          <div className="steps">
            <div className="step">
              <h3>{f.stepOneTitle || "Choose your box"}</h3>
              <p>{f.stepOneBody || "Pick a curated collection in a box of four, six or twelve."}</p>
            </div>
            <div className="step">
              <h3>{f.stepTwoTitle || "Select pickup"}</h3>
              <p>{f.stepTwoBody || "Choose an available pickup date and time in Ivanhoe, Victoria."}</p>
            </div>
            <div className="step">
              <h3>{f.stepThreeTitle || "Pay securely"}</h3>
              <p>{f.stepThreeBody || "Complete payment and receive immediate confirmation."}</p>
            </div>
          </div>
          <div className="how-it-works-cta">
            <Link className="btn btn-dark btn-arrow" href="/crumbs">
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
            <div><h2>{catalogHeading || <>Crumbs for<br />every craving</>}</h2></div>
          </div>
          <div className={`product-grid product-grid-${Math.min(4, products.length)}`}>
            {products.map((product) => (
              <Link className="product-card" href={`/crumbs/${product.slug}`} key={product.id}>
                <div className="relative product-card-render">
                  <ProductCookieImage
                    eager
                    image={productSideProfile(product)}
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
