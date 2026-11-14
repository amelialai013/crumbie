import Link from "next/link";
import type { Product } from "@/lib/catalog";
import { productCardImage } from "@/lib/catalog";
import type { Promo } from "@/lib/card";

export default function PromoBanner({ promo, product }: { promo: Promo; product: Product }) {
  const image = productCardImage(product);
  return (
    <div className="promo-banner">
      <div className="promo-banner-copy">
        {promo.label && <span className="promo-banner-label">{promo.label}</span>}
        <h2>{promo.headline || product.name}</h2>
        {promo.blurb && <p>{promo.blurb}</p>}
        <Link className="btn btn-dark promo-banner-link" href={`/crumbs/${product.slug}`}>
          {promo.button || "Order now"}
          <svg aria-hidden="true" viewBox="0 0 16 16">
            <path d="m6 3.5 4.5 4.5L6 12.5" />
          </svg>
        </Link>
      </div>
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="promo-banner-image" src={image} alt={product.name} />
      )}
    </div>
  );
}
