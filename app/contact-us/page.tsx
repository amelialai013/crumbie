import type { Metadata } from "next";
import CustomOrderForm from "@/components/custom-order-form";

export const metadata: Metadata = { title: "Get in touch" };

export default function ContactUs() {
  return (
    <>
      <section className="page-hero custom-order-hero">
        <div className="shell">
          <h1 className="page-title">Get in touch</h1>
        </div>
      </section>
      <section className="section custom-order-section">
        <div className="shell enquiry-layout">
          <CustomOrderForm />
        </div>
      </section>
    </>
  );
}
