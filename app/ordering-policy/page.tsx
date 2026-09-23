import { sharedKitchenWarning } from "@/lib/catalog";
import SectionReveal from "@/components/section-reveal";

export default function Policy() {
  return (
    <>
      <section className="page-hero">
        <div className="shell">
          <h1 className="page-title">Crumbie policies</h1>
        </div>
      </section>
      <SectionReveal className="section policy-section" itemSelector=".policy-content > *">
        <div className="shell">
          <div className="prose policy-content">
            <h2>Pickup</h2>
            <p>Club Crumbie currently offers pickup only from Ivanhoe, Victoria. Each item must be assigned to an available pickup date and its fixed collection window before checkout. The exact address is provided after successful payment in your confirmation email.</p>
            <h2>Order deadlines</h2>
            <p>Standard box orders close 72 hours before their pickup window. A date or individual product may be marked sold out earlier by Club Crumbie.</p>
            <h2>Payments</h2>
            <p>Standard orders are confirmed immediately after successful payment through Stripe. Prices are in Australian dollars and include GST where applicable.</p>
            <h2>Cancellations and refunds</h2>
            <p>Because products are made for scheduled pickup, paid orders are final and change-of-mind cancellations are not accepted. Nothing in this policy excludes rights or remedies available under Australian Consumer Law.</p>
            <h2>Allergens</h2>
            <p>{sharedKitchenWarning}</p>
            <h2>Custom enquiries</h2>
            <p>A custom-order form submission is an enquiry only. It does not confirm availability, pricing or an order.</p>
          </div>
        </div>
      </SectionReveal>
    </>
  );
}
