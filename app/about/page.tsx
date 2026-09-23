import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import aboutUsImage from "@/assets/images/about-us.png";
import SectionReveal from "@/components/section-reveal";

export const metadata: Metadata = { title: "About" };

export default function About() {
  return (
    <>
      <section className="page-hero">
        <div className="shell"><h1 className="page-title">Crumbie beginnings</h1></div>
      </section>
      <SectionReveal className="section about-section" itemSelector=".about-image, .prose > *">
        <div className="shell content-grid">
          <div className="relative about-image">
            <Image src={aboutUsImage} alt="Baker preparing ingredients in a kitchen" fill sizes="(max-width: 900px) 100vw, 50vw" quality={100} />
          </div>
          <div className="prose">
            <h2>Our story</h2>
            <p>Club Crumbie began with two girls who love baking and have a shared belief that the best things are made with patience and care. We make considered drops that give each collection room to explore depth, richness and quality. The result is familiar, but made with a little more intention.</p>
            <h2>Small batch by design</h2>
            <p>Each release is made in small quantities, giving us room to refine every detail and share something fresh, thoughtful and worth returning to.</p>
            <Link className="btn btn-dark btn-arrow" href="/crumbs">
              Explore crumbs
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                <path d="m7 4.5 5.5 5.5L7 15.5" />
              </svg>
            </Link>
          </div>
        </div>
      </SectionReveal>
    </>
  );
}
