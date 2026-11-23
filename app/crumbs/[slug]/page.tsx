import { productCardImage, productCardIsPhoto, productRotationImages } from "@/lib/catalog";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import PhotoCarousel from "@/components/photo-carousel";
import CookieExplorer from "@/components/cookie-explorer";
import HeroCarousel from "@/components/hero-carousel";
import { cardForProduct } from "@/lib/card";
import { absoluteUrl, siteName } from "@/lib/site";
import ProductCarousel from "@/components/product-carousel";
import ProductCookieImage from "@/components/product-cookie-image";
import ProductOrder from "@/components/product-order";
import { sharedKitchenWarning } from "@/lib/catalog";
import { getCardOption, getGalleryCopy, getGalleryImages, getProducts, getPickupDates, getPromo, getDelivery } from "@/lib/catalog-store";

const legacyProductSlugs: Record<string, string> = {
  "signature-box": "signature-crumbie",
  "seasonal-box": "biscoff-caramel",
};

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const products = await getProducts();
  const product = products.find((item) => item.slug === slug);
  if (!product) return {};
  const image = product.images[0] && /^https?:\/\//.test(product.images[0]) ? [product.images[0]] : ["/og-image.jpg"];
  return {
    title: product.name,
    description: product.description,
    openGraph: { title: product.name, description: product.description, images: image },
    twitter: { card: "summary_large_image", title: product.name, description: product.description, images: image },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  // Availability must reflect admin changes and the current ordering cutoff.
  await connection();
  const { slug } = await params;
  const [products, pickupDates, defaultCard, galleryCopy, sharedGallery, promo, delivery] = await Promise.all([getProducts(), getPickupDates(), getCardOption(), getGalleryCopy(), getGalleryImages(), getPromo(), getDelivery()]);
  const product = products.find((item) => item.slug === slug);
  if (!product && legacyProductSlugs[slug]) {
    redirect(`/crumbs/${legacyProductSlugs[slug]}`);
  }
  if (!product) notFound();
  const card = cardForProduct(defaultCard, promo, product.id);
  const otherProducts = products.filter((item) => item.id !== product.id && !item.soldOut);
  const galleryImages = sharedGallery.length > 0 ? sharedGallery : product.galleryImages || [];

  const productJsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    url: absoluteUrl(`/crumbs/${product.slug}`),
    ...(product.images[0] && /^https?:\/\//.test(product.images[0]) ? { image: product.images[0] } : {}),
    brand: { "@type": "Brand", name: siteName },
    offers: product.variants.map((variant) => ({
      "@type": "Offer",
      name: variant.label,
      sku: variant.id,
      url: absoluteUrl(`/crumbs/${product.slug}`),
      priceCurrency: "AUD",
      price: variant.price.toFixed(2),
      availability: product.soldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: absoluteUrl("/") },
      { "@type": "ListItem", position: 2, name: "Crumbs", item: absoluteUrl("/crumbs") },
      { "@type": "ListItem", position: 3, name: product.name, item: absoluteUrl(`/crumbs/${product.slug}`) },
    ],
  };

  return (
    <section className="section section-warm product-detail-section">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <nav className="shell breadcrumb" aria-label="Breadcrumb">
        <Link href="/crumbs">Crumbs</Link>
        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
          <path d="m6 3.5 4.5 4.5L6 12.5" />
        </svg>
        <span aria-current="page">{product.name}</span>
      </nav>
      <div className="shell product-detail-layout">
        {product.heroMode === "carousel" && (product.heroImages?.length ?? 0) > 0 ? (
          <HeroCarousel key={product.slug} images={product.cardImage ? [product.cardImage, ...(product.heroImages ?? []).filter((image) => image !== product.cardImage)] : product.heroImages ?? []} name={product.name} />
        ) : product.imageMode !== "gallery" && (product.id === "product-signature" || product.id === "product-seasonal") ? (
          <CookieExplorer
            key={product.slug}
            name={product.name}
            variant={product.id === "product-seasonal" ? "biscoff" : "signature"}
          />
        ) : (
          <CookieExplorer
            key={product.slug}
            name={product.name}
            images={productRotationImages(product)}
            initialFrame={0}
          />
        )}
        <div className="product-detail-copy">
          <header className="product-detail-hero">
            <div className="product-detail-heading">
              <h1 className="page-title">{product.name}</h1>
              <div>
                <p>{product.description}</p>
              </div>
            </div>
          </header>
          <ProductOrder product={product} pickupDates={pickupDates} card={card} delivery={delivery} />
        </div>
      </div>
      {galleryImages.length > 0 && !product.hideGallery && (
        <div className="shell product-photo-gallery">
          <div className="product-photo-gallery-copy">
            <h2>{galleryCopy.title}</h2>
            <p>{galleryCopy.body}</p>
          </div>
          <PhotoCarousel images={galleryImages} name={product.name} />
        </div>
      )}
      <div className="shell product-facts">
        <section>
          <h2>Order information</h2>
          <p>{product.ingredients}</p>
        </section>
        <section>
          <h2>Allergen information</h2>
          <p>{product.allergens}</p>
          <p>{sharedKitchenWarning}</p>
        </section>
      </div>
      {otherProducts.length > 0 && (
        <div className="shell">
          <ProductCarousel title="More from Club Crumbie">
            {otherProducts.map((other) => (
              <Link className="product-carousel-card" href={`/crumbs/${other.slug}`} key={other.id}>
                <div className="product-carousel-media">
                  <ProductCookieImage
                    image={productCardImage(other)}
                    photo={productCardIsPhoto(other)}
                    name={other.name}
                    variant={other.id === "product-seasonal" ? "biscoff" : "signature"}
                  />
                </div>
                <div className="product-carousel-body">
                  <div>
                    <h3>{other.name}</h3>
                    <span>Boxes from ${other.variants[0].price}</span>
                  </div>
                  <svg aria-hidden="true" viewBox="0 0 16 16"><path d="m6 3.5 4.5 4.5L6 12.5" /></svg>
                </div>
              </Link>
            ))}
          </ProductCarousel>
        </div>
      )}
    </section>
  );
}
