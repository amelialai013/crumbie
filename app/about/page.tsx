import type { Metadata } from "next";
import Link from "next/link";
import aboutUsImage from "@/assets/images/about-us.webp";
import RevealImage from "@/components/reveal-image";
import SectionReveal from "@/components/section-reveal";
import { getRecord } from "@/lib/store";

export const metadata: Metadata = { title: "About" };

const paragraphs = (text: string) => text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);

export default async function About() {
  const content = await getRecord<{ fields?: Record<string, string> }>("content", "about").catch(() => null);
  const fields = content?.fields || {};
  const pageTitle = fields.pageTitle || "Crumbie beginnings";
  const storyHeading = fields.storyHeading || "Our story";
  const storyCopy = paragraphs(fields.storyCopy || "Club Crumbie began with two girls who love baking and have a shared belief that the best things are made with patience and care. We make considered drops that give each collection room to explore depth, richness and quality. The result is familiar, but made with a little more intention.");
  const batchHeading = fields.batchHeading || "Small batch by design";
  const batchCopy = paragraphs(fields.batchCopy || "Each release is made in small quantities, giving us room to refine every detail and share something fresh, thoughtful and worth returning to.");
  return (
    <>
      <section className="page-hero">
        <div className="shell"><h1 className="page-title">{pageTitle}</h1></div>
      </section>
      <SectionReveal className="section about-section" itemSelector=".prose > *:not(.btn)">
        <div className="shell content-grid">
          <div className="relative about-image">
            <div className="about-image-ph" aria-hidden style={{ backgroundImage: `url("${aboutUsImage.blurDataURL}")` }} />
            <RevealImage mode="css" src={aboutUsImage} alt="Baker preparing ingredients in a kitchen" fill priority sizes="(max-width: 900px) 100vw, 50vw" quality={75} />
          </div>
          <div className="prose">
            <h2>{storyHeading}</h2>
            {storyCopy.map((text, i) => <p key={`s${i}`}>{text}</p>)}
            <h2>{batchHeading}</h2>
            {batchCopy.map((text, i) => <p key={`b${i}`}>{text}</p>)}
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
