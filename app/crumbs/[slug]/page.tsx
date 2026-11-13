import { productRotationImages } from "@/lib/catalog";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import PhotoCarousel from "@/components/photo-carousel";
import CookieExplorer from "@/components/cookie-explorer";
import ProductOrder from "@/components/product-order";
import { sharedKitchenWarning } from "@/lib/catalog";
import { getCardOption, getGalleryCopy, getProducts, getPickupDates } from "@/lib/catalog-store";

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
  return product
    ? { title: product.name, description: product.description, openGraph: { title: product.name, description: product.description, images: [] }, twitter: { card: "summary", title: product.name, description: product.description, images: [] } }
    : {};
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  // Availability must reflect admin changes and the current ordering cutoff.
  await connection();
  const { slug } = await params;
  const [products, pickupDates, card, galleryCopy] = await Promise.all([getProducts(), getPickupDates(), getCardOption(), getGalleryCopy()]);
  const product = products.find((item) => item.slug === slug);
  if (!product && legacyProductSlugs[slug]) {
    redirect(`/crumbs/${legacyProductSlugs[slug]}`);
  }
  if (!product) notFound();

  return (
    <section className="section section-warm product-detail-section">
      <nav className="shell breadcrumb" aria-label="Breadcrumb">
        <Link href="/crumbs">Crumbs</Link>
        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
          <path d="m6 3.5 4.5 4.5L6 12.5" />
        </svg>
        <span aria-current="page">{product.name}</span>
      </nav>
      <div className="shell product-detail-layout">
        {product.imageMode !== "gallery" && (product.id === "product-signature" || product.id === "product-seasonal") ? (
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
          <ProductOrder product={product} pickupDates={pickupDates} card={card} />
        </div>
      </div>
      {product.galleryImages && product.galleryImages.length > 0 && (
        <div className="shell product-photo-gallery">
          <div className="product-photo-gallery-copy">
            <h2>{galleryCopy.title}</h2>
            <p>{galleryCopy.body}</p>
          </div>
          <PhotoCarousel images={product.galleryImages} name={product.name} />
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
    </section>
  );
}
