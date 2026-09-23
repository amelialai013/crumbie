import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <section className="page-hero not-found-hero">
      <div className="shell not-found-content">
        <span className="fine-print">404</span>
        <h1 className="page-title">This crumb wandered off</h1>
        <p className="lede">
          The page you’re looking for doesn’t exist, or has moved. Let’s get you back to something delicious.
        </p>
        <div className="actions">
          <Link className="btn btn-dark btn-arrow" href="/crumbs">
            Explore crumbs
            <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
              <path d="m7 4.5 5.5 5.5L7 15.5" />
            </svg>
          </Link>
          <Link className="btn btn-light" href="/">Back home</Link>
        </div>
      </div>
    </section>
  );
}
