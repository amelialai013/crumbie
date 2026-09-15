import type { Metadata } from "next";
import Link from "next/link";
import ProductCookieImage from "@/components/product-cookie-image";
import { products } from "@/lib/catalog";

export const metadata: Metadata = { title: "Crumbs" };

export default function Crumbs() {
  return (
    <>
      <section className="page-hero">
        <div className="shell">
          <h1 className="page-title">Crumbs</h1>
        </div>
      </section>
      <section className="section section-warm cookie-catalog">
        <div className="shell">
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
                    <span className="price">From ${product.variants[0].price}</span>
                  </div>
                  <span className="product-card-action">
                    Order now
                    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                      <path d="m7 4.5 5.5 5.5L7 15.5" />
                    </svg>
                  </span>
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
