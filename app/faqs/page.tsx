import type { Metadata } from "next";
import { sharedKitchenWarning } from "@/lib/catalog";
import SectionReveal from "@/components/section-reveal";
import { getRecord } from "@/lib/store";

type FaqContent = { fields?: Record<string, string>; sections?: { heading: string; body: string }[]; removedFields?: string[] };

const paragraphs = (text: string) => text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);

export const metadata: Metadata = { title: "FAQs", description: "Answers about pickup, payment, cancellations and allergens for Club Crumbie orders." };

export default async function Faqs() {
  const content = await getRecord<FaqContent>("content", "faqs").catch(() => null);
  const f = content?.fields || {};
  const removed = content?.removedFields || [];
  const items = [
    { key: "pickup", question: f.pickupHeading || "Where do I pick up my order?", answer: f.pickupCopy || "Club Crumbie currently offers pickup only from Ivanhoe, Victoria. Choose a pickup window at checkout. The exact address is sent in your confirmation email after payment." },
    { key: "deadline", question: f.deadlineHeading || "When do orders close?", answer: f.deadlineCopy || "Standard box orders close 72 hours before their pickup window. A window or individual product may sell out earlier." },
    { key: "payment", question: f.paymentHeading || "How do I pay?", answer: f.paymentCopy || "Payment is taken securely by Stripe at checkout and your order is confirmed straight away. Prices are in Australian dollars and include GST where applicable." },
    { key: "cancellation", question: f.cancellationHeading || "Can I cancel or get a refund?", answer: f.cancellationCopy || "Every order is made for its scheduled pickup, so change-of-mind cancellations aren't accepted. If something is wrong with your order, get in touch. Nothing here limits your rights under Australian Consumer Law." },
    { key: "allergen", question: f.allergenHeading || "Do your products contain allergens?", answer: f.allergenCopy || sharedKitchenWarning, removable: true },
    { key: "enquiry", question: f.enquiryHeading || "Does a custom enquiry confirm my order?", answer: f.enquiryCopy || "No. Submitting the custom-order form is an enquiry only. It doesn't confirm availability, pricing or an order until we reply.", removable: true },
  ].filter((item) => !(item.removable && (removed.includes(`${item.key}Heading`) || removed.includes(`${item.key}Copy`))));
  const extra = (content?.sections || []).map((section, i) => ({ key: `extra-${i}`, question: section.heading, answer: section.body }));

  return (
    <>
      <section className="page-hero">
        <div className="shell">
          <h1 className="page-title">{f.pageTitle || "FAQs"}</h1>
        </div>
      </section>
      <SectionReveal className="section policy-section" itemSelector=".faq-list > *">
        <div className="shell">
          <div className="faq-list">
            {[...items, ...extra].map((item) => (
              <details className="faq-item" key={item.key}>
                <summary>
                  <h2>{item.question}</h2>
                  <svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="m4 6 4 4 4-4" /></svg>
                </summary>
                <div className="faq-answer">
                  {paragraphs(item.answer).map((text, i) => <p key={i}>{text}</p>)}
                </div>
              </details>
            ))}
          </div>
        </div>
      </SectionReveal>
    </>
  );
}
