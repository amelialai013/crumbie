import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = { title: "About" };

export default function About() {
  return (
    <>
      <section className="page-hero">
        <div className="shell"><h1 className="page-title">Made slowly.<br />Enjoyed quickly.</h1></div>
      </section>
      <section className="section">
        <div className="shell content-grid">
          <div className="relative about-image">
            <Image src="https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=1400&q=88" alt="Baker preparing ingredients in a kitchen" fill sizes="(max-width: 900px) 100vw, 50vw" />
          </div>
          <div className="prose">
            <h2>Crumbie began with a simple idea.</h2>
            <p>Make fewer things, and make them properly. Thoughtful flavours, generous cookies and a pickup experience that feels as considered as the box itself.</p>
            <p>Every collection is built around balance: crisp edges, soft centres, rich chocolate and just enough salt. The result is familiar, but with a little more intention.</p>
            <h2>Small batch by design</h2>
            <p>Cookies are prepared for published pickup dates in Ivanhoe. Standard boxes use curated assortments, while custom requests leave room for something different.</p>
            <Link className="btn btn-dark btn-arrow" href="/cookies">
              See the boxes
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                <path d="m7 4.5 5.5 5.5L7 15.5" />
              </svg>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
