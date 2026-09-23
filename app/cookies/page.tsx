import type { Metadata } from "next";
import Link from "next/link";
import ProductCookieImage from "@/components/product-cookie-image";
import { getProducts } from "@/lib/catalog-store";

export const metadata: Metadata = { title: "Crumbs" };

export default async function Crumbs() {
  const products = await getProducts();
  return (
    <>
      <section className="page-hero">
        <div className="shell">
          <h1 className="page-title">Crumb selection</h1>
        </div>
      </section>
      <section className="section section-warm cookie-catalog crumbs-catalog">
        <div className="shell">
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
          <div className="notice custom-order-notice">Need another quantity or something entirely your own? <Link href="/contact-us">Contact us</Link></div>
        </div>
      </section>
    </>
  );
}
