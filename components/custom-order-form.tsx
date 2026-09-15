"use client";

import { useState } from "react";
import PremiumSelect from "./premium-select";

export default function CustomOrderForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [enquiryType, setEnquiryType] = useState("general");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("sending");
    try {
      const form = new FormData(e.currentTarget);
      const res = await fetch("/api/custom-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(form)),
      });
      setStatus(res.ok ? "done" : "error");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="enquiry-form enquiry-success">
        <h2>Thank you.</h2>
        <p>We’ve received your message and will be in touch soon.</p>
      </div>
    );
  }

  return (
    <form className="enquiry-form" onSubmit={submit}>
      <div className="enquiry-fields-row">
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" name="name" autoComplete="name" required maxLength={100} />
        </div>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required maxLength={200} />
        </div>
        <div className="field">
          <label htmlFor="phone">Phone</label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" required maxLength={40} />
        </div>
        <div className="field">
          <span className="field-label" id="enquiry-type-label">Enquiry type</span>
          <input type="hidden" name="enquiryType" value={enquiryType} />
          <PremiumSelect
            labelId="enquiry-type-label"
            value={enquiryType}
            options={[
              { value: "general", label: "General enquiry" },
              { value: "custom-order", label: "Custom order" },
            ]}
            placeholder="General enquiry"
            onChange={setEnquiryType}
          />
        </div>
      </div>
      <div className="field">
        <label htmlFor="request">Your message</label>
        <textarea id="request" name="request" placeholder="Tell us how we can help. For custom orders, include the occasion, quantity and timing you have in mind." required minLength={10} maxLength={3000} />
      </div>
      {status === "error" && <p className="field-error" role="alert">We couldn’t send your message. Please try again.</p>}
      <button type="submit" className="btn btn-dark btn-arrow enquiry-submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Send message"}
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
          <path d="m7 4.5 5.5 5.5L7 15.5" />
        </svg>
      </button>
    </form>
  );
}
