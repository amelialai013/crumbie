import { productCardImage, productCardIsPhoto } from "@/lib/catalog";
import Link from "next/link";
import { getImageProps } from "next/image";
import NewsletterSignup from "@/components/newsletter-signup";
import PromoBanner from "@/components/promo-banner";
import { getCountdown, getHeroImage, getLanding, getProducts, getPromo } from "@/lib/catalog-store";
import whiteLogo from "@/brand/latest-logos/new-text-logo/text-white.png";
import whiteVerticalLogo from "@/brand/latest-logos/new-text-logo/white-vertical-logo.png";
import FeatureHeroGate from "@/components/feature-hero-gate";
import HeroMedia from "@/components/hero-media";
import HeroCountdown from "@/components/hero-countdown";
import ProductCookieImage from "@/components/product-cookie-image";
import SectionReveal from "@/components/section-reveal";
import { getRecord } from "@/lib/store";

export default async function Home() {
  const [allProducts, promo, heroImage, landingSettings, countdown] = await Promise.all([getProducts(), getPromo(), getHeroImage(), getLanding(), getCountdown()]);
  const featured = promo ? allProducts.find((product) => product.id === promo.productId) : undefined;
  const products = featured ? allProducts.filter((product) => product.id !== featured.id) : allProducts;
  const content = await getRecord<{ fields?: Record<string, string> }>("content", "homepage").catch(() => null);
  const f = content?.fields || {};
  const catalogHeading = f.catalogHeading && f.catalogHeading !== "Crumbs for every craving" ? f.catalogHeading : null;
  const logoProps = { alt: "Club Crumbie", quality: 100 };
  const { props: desktopLogo } = getImageProps({ ...logoProps, src: whiteLogo, sizes: "640px" });
  const { props: featureLogo } = getImageProps({ ...logoProps, src: whiteLogo, sizes: "(max-width: 900px) 480px, 640px" });
  const { props: featureMobileLogo } = getImageProps({ ...logoProps, src: whiteVerticalLogo, sizes: "340px" });
  const { props: mobileLogo } = getImageProps({ ...logoProps, src: whiteVerticalLogo, sizes: "340px" });
  const countdownEnded = countdown.active && countdown.enabled && countdown.target <= Date.now() && allProducts.some((product) => product.id === countdown.nextProductId);
  const landingProduct = allProducts.find((product) => product.id === (countdownEnded ? countdown.nextProductId : landingSettings.productId));
  const mainPhoto = landingProduct?.heroMode === "carousel" ? landingProduct.heroImages?.[0] : undefined;
  const cardPhoto = landingProduct && productCardIsPhoto(landingProduct) ? productCardImage(landingProduct) : undefined;
  const sharesCopy = promo?.productId === landingProduct?.id;
  const landingCopy = {
    headline: sharesCopy ? promo?.headline ?? "" : "",
    blurb: sharesCopy ? promo?.blurb ?? "" : "",
    button: promo?.button || "Order now",
    layout: landingSettings.layout,
    pill: landingSettings.pill,
    items: landingSettings.items,
  };
  const landing = (landingSettings.enabled || countdownEnded) && landingProduct && mainPhoto ? { promo: landingCopy, product: landingProduct, mainPhoto, cardPhoto } : null;
  const arrow = (
    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
      <path d="m7 4.5 5.5 5.5L7 15.5" />
    </svg>
  );
  const logo = (
    <h1 className="feature-hero-logo">
      {/* eslint-disable-next-line jsx-a11y/alt-text -- alt is in featureLogo */}
      <picture>
        <source media="(max-width: 640px)" srcSet={featureMobileLogo.srcSet} sizes={featureMobileLogo.sizes} />
        <img {...featureLogo} className="hero-logo" loading="eager" fetchPriority="high" />
      </picture>
    </h1>
  );
  const title = landing ? landing.promo.headline || landing.product.name : "";
  const blurb = landing ? landing.promo.blurb || landing.product.description : "";
  return (
    <>
      {landing && landing.promo.layout === "split" ? (
        <section className="feature-hero fh-split" id="feature-hero" data-gate="pending">
          <FeatureHeroGate targetId="feature-hero" />
          <div className="feature-hero-inner">
            <div className="feature-hero-copy">
              {logo}
              <h2>{title}</h2>
              <p>{blurb}</p>
              <div className="actions">
                <Link className="btn btn-dark btn-arrow" href={`/crumbs/${landing.product.slug}`}>{landing.promo.button}{arrow}</Link>
                <Link className="btn btn-light" href="/crumbs">{f.heroPrimaryLabel || "Explore all crumbs"}</Link>
              </div>
            </div>
            <div className="fh-split-pic fh-item">
              <Link className="fh-split-main" href={`/crumbs/${landing.product.slug}`} aria-label={landing.product.name}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={landing.mainPhoto} alt={landing.product.name} fetchPriority="high" />
              </Link>
              {landing.cardPhoto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img className="fh-split-card" src={landing.cardPhoto} alt="" />
              )}
            </div>
          </div>
        </section>
      ) : landing && landing.promo.layout === "triptych" ? (
        <section className="feature-hero fh-tri" id="feature-hero" data-gate="pending">
          <FeatureHeroGate targetId="feature-hero" />
          <div className="feature-hero-inner">
            <div className="feature-hero-copy">
              {logo}
              <h2>{title}</h2>
            </div>
            <div className="fh-tri-grid">
              <div className="fh-tri-side fh-item">
                <p>{blurb}</p>
                <div className="actions">
                  <Link className="btn btn-dark btn-arrow" href={`/crumbs/${landing.product.slug}`}>{landing.promo.button}{arrow}</Link>
                  <Link className="btn btn-light" href="/contact-us">{f.heroSecondaryLabel || "Make an enquiry"}</Link>
                </div>
              </div>
              <Link className="fh-tri-mid fh-item" href={`/crumbs/${landing.product.slug}`} aria-label={landing.product.name}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={landing.mainPhoto} alt={landing.product.name} fetchPriority="high" />
                {landing.promo.pill && <span className="fh-tri-cap">{landing.promo.pill}</span>}
              </Link>
              <div className="fh-tri-stack fh-item">
                <div className="fh-tri-list">
                  {(landing.promo.items.length ? landing.promo.items : landing.product.variants.map((variant) => variant.label)).map((item, index) => (
                    <div key={`${item}-${index}`}>{item}<span>{String(index + 1).padStart(2, "0")}</span></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : landing ? (
        <section className="feature-hero" id="feature-hero" data-gate="pending">
          <FeatureHeroGate targetId="feature-hero" />
          <div className="feature-hero-inner">
            <div className="feature-hero-copy">
              <h1 className="feature-hero-logo">
                {/* eslint-disable-next-line jsx-a11y/alt-text -- alt is in desktopLogo */}
                <picture>
                  <source media="(max-width: 640px)" srcSet={featureMobileLogo.srcSet} sizes={featureMobileLogo.sizes} />
                  <img {...featureLogo} className="hero-logo" loading="eager" fetchPriority="high" />
                </picture>
              </h1>
              <h2>{landing.promo.headline || landing.product.name}</h2>
              <p>{landing.promo.blurb || landing.product.description}</p>
              <div className="actions">
                <Link className="btn btn-dark btn-arrow" href={`/crumbs/${landing.product.slug}`}>
                  {landing.promo.button}
                  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                    <path d="m7 4.5 5.5 5.5L7 15.5" />
                  </svg>
                </Link>
                <Link className="btn btn-light" href="/crumbs">{f.heroPrimaryLabel || "Explore all crumbs"}</Link>
              </div>
            </div>
            <div className={`feature-hero-collage${landing.cardPhoto ? "" : " is-single"}`}>
              <Link className="feature-hero-photo feature-hero-main" href={`/crumbs/${landing.product.slug}`} aria-label={landing.product.name}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={landing.mainPhoto} alt={landing.product.name} fetchPriority="high" />
              </Link>
              {landing.cardPhoto && (
                <Link className="feature-hero-photo feature-hero-card" href={`/crumbs/${landing.product.slug}`} aria-label={landing.product.name}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={landing.cardPhoto} alt="" />
                </Link>
              )}
              <div className="feature-hero-note fh-tri-list">
                {(landing.promo.items.length ? landing.promo.items : landing.product.variants.map((variant) => variant.label)).map((item, index) => (
                  <div key={`${item}-${index}`}>{item}<span>{String(index + 1).padStart(2, "0")}</span></div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : (
      <section className={`hero${countdown.active && countdown.enabled ? " hero-countdown-on" : ""}${countdown.active ? " hero-countdown-layout" : ""}`}>
        <HeroMedia image={heroImage} />
        <div className="hero-content">
          <h1 className="hero-logo-heading">
            <picture>
              <source media="(max-width: 640px)" srcSet={mobileLogo.srcSet} sizes={mobileLogo.sizes} />
              {/* eslint-disable-next-line jsx-a11y/alt-text -- alt is in desktopLogo */}
              <img {...desktopLogo} className="hero-logo" fetchPriority="high" />
            </picture>
          </h1>
          {countdown.active && countdown.enabled && <HeroCountdown refreshOnEnd={!!countdown.nextProductId} target={countdown.target} label={countdown.label} />}
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
      )}

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
              <p>{f.stepTwoBody || "Choose an available pickup window in Ivanhoe, Victoria."}</p>
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
          {featured && promo && (
            <div className="home-promo-banner">
              <PromoBanner promo={promo} product={featured} />
            </div>
          )}
          <div className={`product-grid product-grid-${Math.min(4, products.length)}`}>
            {products.map((product) => (
              <Link className="product-card" href={`/crumbs/${product.slug}`} key={product.id}>
                <div className="relative product-card-render">
                  <ProductCookieImage
                    eager
                    image={productCardImage(product)}
                    photo={productCardIsPhoto(product)}
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
      <SectionReveal className="section newsletter-section">
        <div className="shell">
          <NewsletterSignup
            heading={f.newsletterHeading || "Join the Club"}
            body={f.newsletterBody || "New boxes, seasonal flavours and the odd treat, straight to your inbox."}
            wordTwo={f.newsletterWordTwo || "New boxes"}
            wordThree={f.newsletterWordThree || "Seasonal flavours"}
            wordFour={f.newsletterWordFour || "Early access"}
            button={f.newsletterButton || "Subscribe"}
            note={f.newsletterNote ?? "No spam. Unsubscribe any time."}
            doneTitle={f.newsletterDoneTitle || "Almost there"}
            doneBody={f.newsletterDoneBody || "Check your inbox and confirm your email to join."}
          />
        </div>
      </SectionReveal>
    </>
  );
}
