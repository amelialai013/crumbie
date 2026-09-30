import type { Metadata } from "next";
import { connection } from "next/server";
import CustomOrderForm from "@/components/custom-order-form";
import { parseEnquiryTypes } from "@/lib/email-templates";
import { getRecord } from "@/lib/store";

export const metadata: Metadata = { title: "Get in touch" };

export default async function ContactUs() {
  // Enquiry types are managed in the admin portal, so read them per request.
  await connection();
  const content = await getRecord<{ fields?: Record<string, string> }>("content", "contact us").catch(() => null);
  const enquiryTypes = parseEnquiryTypes(content?.fields?.enquiryTypes);

  return (
    <>
      <section className="page-hero custom-order-hero">
        <div className="shell">
          <h1 className="page-title">Get in touch</h1>
        </div>
      </section>
      <section className="section custom-order-section">
        <div className="shell enquiry-layout">
          <CustomOrderForm enquiryTypes={enquiryTypes} />
        </div>
      </section>
    </>
  );
}
