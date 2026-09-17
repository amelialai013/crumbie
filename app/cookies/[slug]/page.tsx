import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import CookieExplorer from "@/components/cookie-explorer";
import ProductGallery from "@/components/product-gallery";
import ProductOrder from "@/components/product-order";
import { products, sharedKitchenWarning } from "@/lib/catalog";

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = products.find((item) => item.slug === slug);
  return product
    ? { title: product.name, description: product.description, openGraph: { title: product.name, description: product.description, images: [] }, twitter: { card: "summary", title: product.name, description: product.description, images: [] } }
    : {};
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = products.find((item) => item.slug === slug);
  if (!product) notFound();

  return (
    <section className="section section-warm product-detail-section">
      <nav className="shell breadcrumb" aria-label="Breadcrumb">
        <Link href="/cookies" scroll={false}>Crumbs</Link>
        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
          <path d="m6 3.5 4.5 4.5L6 12.5" />
        </svg>
        <span aria-current="page">{product.name}</span>
      </nav>
      <div className="shell product-detail-layout">
        <div className="product-detail-copy">
          <header className="product-detail-hero">
            <div className="product-detail-heading">
              <h1 className="page-title">{product.name}</h1>
              <div>
                <p>{product.description}</p>
              </div>
            </div>
          </header>
          <ProductOrder product={product} />
        </div>
        {product.slug === "signature-box" || product.slug === "seasonal-box" ? (
          <CookieExplorer
            key={product.slug}
            name={product.name}
            variant={product.slug === "seasonal-box" ? "biscoff" : "signature"}
          />
        ) : (
          <ProductGallery images={product.images} name={product.name} />
        )}
      </div>
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
