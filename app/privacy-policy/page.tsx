import type { Metadata } from "next";
import SectionReveal from "@/components/section-reveal";

export const metadata: Metadata = { title: "Privacy policy", description: "How Club Crumbie collects, uses and protects your personal information." };

export default function PrivacyPolicy() {
  return (
    <>
      <section className="page-hero">
        <div className="shell">
          <h1 className="page-title">Privacy policy</h1>
        </div>
      </section>
      <SectionReveal className="section policy-section" itemSelector=".policy-content > *">
        <div className="shell">
          <div className="prose policy-content">
            <h2>Who we are</h2>
            <p>Club Crumbie is a small cookie bakery in Ivanhoe, Victoria, Australia. You can reach us at hello@clubcrumbie.com.</p>
            <h2>What we collect</h2>
            <p>When you place an order or send an enquiry we collect your name, email address, phone number, pickup details and any message or order notes you provide. Payments are processed by Stripe, so we never see or store your card details.</p>
            <h2>How we use it</h2>
            <p>We use your information only to prepare and confirm your order, arrange pickup, reply to enquiries and meet our legal and tax obligations. We do not sell your information or use it for third-party advertising.</p>
            <h2>Who we share it with</h2>
            <p>We share information only with the services that help us run the shop: Stripe for payments, our email provider for order and enquiry emails, and our hosting provider. These providers may process data outside Australia.</p>
            <h2>Cookies</h2>
            <p>This site stores your cart in your browser so it persists between visits. We do not use advertising or tracking cookies.</p>
            <h2>Your rights</h2>
            <p>You can ask to access, correct or delete the personal information we hold about you by emailing hello@clubcrumbie.com. We keep order records for as long as required for tax and consumer law purposes.</p>
          </div>
        </div>
      </SectionReveal>
    </>
  );
}
