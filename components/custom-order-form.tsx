"use client";

import { useState } from "react";
import PremiumSelect from "./premium-select";

const fieldLabels: Record<string, string> = {
  name: "Name",
  email: "Email",
  phone: "Phone",
  request: "Your message",
};

export default function CustomOrderForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [enquiryType, setEnquiryType] = useState("general");
  const [errorMessage, setErrorMessage] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  function clearValidationError(field: string) {
    setValidationErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function validationMessage(field: HTMLInputElement | HTMLTextAreaElement) {
    if (field.validity.valueMissing) return `${fieldLabels[field.name] || "This field"} is required`;
    if (field.validity.typeMismatch) return "Enter a valid email address";
    if (field.validity.patternMismatch && field.name === "phone") return "Enter a valid phone number";
    if (field.validity.tooShort) return `${fieldLabels[field.name] || "This field"} is too short`;
    return "Enter a valid value";
  }

  function showValidationError(field: HTMLInputElement | HTMLTextAreaElement) {
    if (field.validity.valid) {
      clearValidationError(field.name);
      return false;
    }
    setValidationErrors((current) => ({
      ...current,
      [field.name]: validationMessage(field),
    }));
    setErrorMessage("");
    setStatus("error");
    return true;
  }

  function handleFieldBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    showValidationError(e.currentTarget);
  }

  function handleFieldChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    clearValidationError(e.currentTarget.name);
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const invalidFields = Array.from(form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(":invalid"));
    if (invalidFields.length > 0) {
      setValidationErrors(Object.fromEntries(invalidFields.map((field) => [field.name, validationMessage(field)])));
      setErrorMessage("");
      setStatus("error");
      invalidFields[0].focus();
      return;
    }
    setStatus("sending");
    setErrorMessage("");
    setValidationErrors({});
    try {
      const formData = new FormData(form);
      const res = await fetch("/api/custom-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(formData)),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErrorMessage(data && typeof data.error === "string" ? data.error : "We couldn’t send your message. Please try again.");
      }
      setStatus(res.ok ? "done" : "error");
    } catch {
      setErrorMessage("We couldn’t send your message. Please check your connection and try again.");
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
    <form className="enquiry-form" onSubmit={submit} noValidate>
      <div className="enquiry-fields-row">
        <div className="enquiry-field-group">
          <div className={`field${validationErrors.name ? " has-error" : ""}`}>
            <label htmlFor="name">Name</label>
            <input id="name" name="name" autoComplete="name" required maxLength={100} aria-invalid={Boolean(validationErrors.name)} aria-describedby={validationErrors.name ? "name-error" : undefined} onChange={handleFieldChange} onBlur={handleFieldBlur} />
          </div>
          {validationErrors.name && <p id="name-error" className="field-error" role="alert">{validationErrors.name}</p>}
        </div>
        <div className="enquiry-field-group">
          <div className={`field${validationErrors.email ? " has-error" : ""}`}>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required maxLength={200} aria-invalid={Boolean(validationErrors.email)} aria-describedby={validationErrors.email ? "email-error" : undefined} onChange={handleFieldChange} onBlur={handleFieldBlur} />
          </div>
          {validationErrors.email && <p id="email-error" className="field-error" role="alert">{validationErrors.email}</p>}
        </div>
        <div className="enquiry-field-group">
          <div className={`field${validationErrors.phone ? " has-error" : ""}`}>
            <label htmlFor="phone">Phone</label>
            <input id="phone" name="phone" type="tel" autoComplete="tel" required maxLength={40} pattern="[+()0-9\s-]{6,40}" aria-invalid={Boolean(validationErrors.phone)} aria-describedby={validationErrors.phone ? "phone-error" : undefined} onChange={handleFieldChange} onBlur={handleFieldBlur} />
          </div>
          {validationErrors.phone && <p id="phone-error" className="field-error" role="alert">{validationErrors.phone}</p>}
        </div>
        <div className="enquiry-field-group">
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
      </div>
      <div className="enquiry-field-group">
        <div className={`field${validationErrors.request ? " has-error" : ""}`}>
          <label htmlFor="request">Your message</label>
          <textarea id="request" name="request" placeholder="Tell us how we can help. For custom orders, include the occasion, quantity and timing you have in mind." required minLength={10} maxLength={3000} aria-invalid={Boolean(validationErrors.request)} aria-describedby={validationErrors.request ? "request-error" : undefined} onChange={handleFieldChange} onBlur={handleFieldBlur} />
        </div>
        {validationErrors.request && <p id="request-error" className="field-error" role="alert">{validationErrors.request}</p>}
      </div>
      <button type="submit" className="btn btn-dark btn-arrow enquiry-submit" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : "Send message"}
        <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
          <path d="m7 4.5 5.5 5.5L7 15.5" />
        </svg>
      </button>
      {status === "error" && Object.keys(validationErrors).length === 0 && <p className="field-error enquiry-submit-error" role="alert">{errorMessage || "We couldn’t send your message. Please try again."}</p>}
    </form>
  );
}
