import type { Metadata } from "next";
import CustomOrderForm from "@/components/custom-order-form";

export const metadata: Metadata = { title: "Contact us" };

export default function ContactUs() {
  return (
    <>
      <section className="page-hero custom-order-hero">
        <div className="shell">
          <h1 className="page-title">Contact us</h1>
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
