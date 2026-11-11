import { Fragment } from "react";
import { sharedKitchenWarning } from "@/lib/catalog";
import SectionReveal from "@/components/section-reveal";
import { getRecord } from "@/lib/store";

type PolicyContent = { fields?: Record<string, string>; sections?: { heading: string; body: string }[]; removedFields?: string[] };

const paragraphs = (text: string) => text.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);

export default async function Policy() {
  const content = await getRecord<PolicyContent>("content", "policy").catch(() => null);
  const f = content?.fields || {};
  const removed = content?.removedFields || [];
  const sections = [
    { key: "pickup", heading: f.pickupHeading || "Pickup", body: f.pickupCopy || "Club Crumbie currently offers pickup only from Ivanhoe, Victoria. Each item must be assigned to an available pickup date and its fixed collection window before checkout. The exact address is provided after successful payment in your confirmation email." },
    { key: "deadline", heading: f.deadlineHeading || "Order deadlines", body: f.deadlineCopy || "Standard box orders close 72 hours before their pickup window. A date or individual product may be marked sold out earlier by Club Crumbie." },
    { key: "payment", heading: f.paymentHeading || "Payments", body: f.paymentCopy || "Standard orders are confirmed immediately after successful payment through Stripe. Prices are in Australian dollars and include GST where applicable." },
    { key: "cancellation", heading: f.cancellationHeading || "Cancellations and refunds", body: f.cancellationCopy || "Because products are made for scheduled pickup, paid orders are final and change-of-mind cancellations are not accepted. Nothing in this policy excludes rights or remedies available under Australian Consumer Law." },
    { key: "allergen", heading: f.allergenHeading || "Allergens", body: f.allergenCopy || sharedKitchenWarning, removable: true },
    { key: "enquiry", heading: f.enquiryHeading || "Custom enquiries", body: f.enquiryCopy || "A custom-order form submission is an enquiry only. It does not confirm availability, pricing or an order.", removable: true },
  ].filter((section) => !(section.removable && (removed.includes(`${section.key}Heading`) || removed.includes(`${section.key}Copy`))));
  const extra = (content?.sections || []).map((section, i) => ({ key: `extra-${i}`, heading: section.heading, body: section.body }));

  return (
    <>
      <section className="page-hero">
        <div className="shell">
          <h1 className="page-title">{f.pageTitle || "Crumbie policies"}</h1>
        </div>
      </section>
      <SectionReveal className="section policy-section" itemSelector=".policy-content > *">
        <div className="shell">
          <div className="prose policy-content">
            {[...sections, ...extra].map((section) => (
              <Fragment key={section.key}>
                <h2>{section.heading}</h2>
                {paragraphs(section.body).map((text, i) => <p key={i}>{text}</p>)}
              </Fragment>
            ))}
          </div>
        </div>
      </SectionReveal>
    </>
  );
}
