import type { Metadata } from "next";
import { Fragment } from "react";
import SectionReveal from "@/components/section-reveal";
import { getRecord } from "@/lib/store";
import { termsDefaultTitle, termsDefaults } from "@/lib/terms";

export const metadata: Metadata = { title: "Terms of service", description: "The terms that apply when you order from Club Crumbie." };

const paragraphs = (text: string) => text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);

export default async function TermsOfService() {
  const content = await getRecord<{ fields?: Record<string, string> }>("content", "terms of service").catch(() => null);
  const f = content?.fields || {};
  const sections = termsDefaults
    .map((section, i) => ({ heading: f[`s${i + 1}Heading`] ?? section.heading, body: f[`s${i + 1}Copy`] ?? section.body }))
    .filter((section) => section.heading || section.body);

  return (
    <>
      <section className="page-hero">
        <div className="shell">
          <h1 className="page-title">{f.pageTitle || termsDefaultTitle}</h1>
        </div>
      </section>
      <SectionReveal className="section policy-section" itemSelector=".policy-content > *">
        <div className="shell">
          <div className="prose policy-content">
            {sections.map((section, i) => (
              <Fragment key={i}>
                {section.heading && <h2>{section.heading}</h2>}
                {paragraphs(section.body).map((text, j) => <p key={j}>{text}</p>)}
              </Fragment>
            ))}
          </div>
        </div>
      </SectionReveal>
    </>
  );
}
