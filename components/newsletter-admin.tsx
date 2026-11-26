"use client";

import { useEffect, useState } from "react";

export default function NewsletterAdmin({ onSuccess }: { onSuccess?: (message: string) => void }) {
  const [subscribers, setSubscribers] = useState<number | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [buttonLabel, setButtonLabel] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [busy, setBusy] = useState<"" | "test" | "send">("");
  const [notice, setNotice] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ subject?: string; body?: string }>({});

  useEffect(() => {
    fetch("/api/admin/newsletter")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setSubscribers(typeof data?.subscribers === "number" ? data.subscribers : null))
      .catch(() => null);
  }, []);

  async function submit(mode: "test" | "send") {
    const errors: { subject?: string; body?: string } = {};
    if (!subject.trim()) errors.subject = "Add a subject.";
    if (!body.trim()) errors.body = "Add a message.";
    setFieldErrors(errors);
    if (errors.subject || errors.body) {
      const target = document.getElementById(errors.subject ? "nl-subject" : "nl-body");
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      target?.focus({ preventScroll: true });
      return;
    }
    const when = scheduledAt ? ` on ${new Date(scheduledAt).toLocaleString()}` : " now";
    if (mode === "send" && !window.confirm(`Send this newsletter to ${subscribers ?? "all"} subscribers${when}?`)) return;
    setBusy(mode);
    setNotice("");
    const res = await fetch("/api/admin/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        subject,
        body,
        buttonLabel,
        buttonUrl,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : "",
      }),
    }).catch(() => null);
    setBusy("");
    const data = await res?.json().catch(() => null);
    if (!res?.ok) return setNotice(data?.error || "Unable to send.");
    onSuccess?.(mode === "test" ? "Test sent to the admin inbox." : scheduledAt ? "Newsletter scheduled." : "Newsletter sent.");
    if (mode === "send") {
      setSubject("");
      setBody("");
      setButtonLabel("");
      setButtonUrl("");
      setScheduledAt("");
    }
  }

  return (
    <div className="admin-newsletter admin-editor">
      <div className={`field${fieldErrors.subject ? " has-error" : ""}`}>
        <label htmlFor="nl-subject">Subject</label>
        <input id="nl-subject" maxLength={200} aria-invalid={!!fieldErrors.subject} value={subject} onChange={(e) => { setSubject(e.target.value); setFieldErrors((f) => ({ ...f, subject: undefined })); }} />
        {fieldErrors.subject && <p className="field-error" role="alert">{fieldErrors.subject}</p>}
      </div>
      <div className={`field${fieldErrors.body ? " has-error" : ""}`}>
        <label htmlFor="nl-body">Message</label>
        <textarea id="nl-body" className="admin-textarea-lines" style={{ "--lines": 10 } as React.CSSProperties} aria-invalid={!!fieldErrors.body} value={body} onChange={(e) => { setBody(e.target.value); setFieldErrors((f) => ({ ...f, body: undefined })); }} />
        {fieldErrors.body && <p className="field-error" role="alert">{fieldErrors.body}</p>}
        <small className="admin-newsletter-hint">Leave a blank line between paragraphs. An unsubscribe link is added automatically.</small>
      </div>
      <div className="field">
        <label htmlFor="nl-button-label">Button text (optional)</label>
        <input id="nl-button-label" maxLength={60} placeholder="Order now" value={buttonLabel} onChange={(e) => setButtonLabel(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="nl-button-url">Button link (optional)</label>
        <input id="nl-button-url" type="url" placeholder="https://clubcrumbie.com" value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="nl-schedule">Schedule (optional, leave blank to send now)</label>
        <input id="nl-schedule" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
      </div>
      <div className="admin-newsletter-actions">
        <button className="btn btn-light" type="button" disabled={!!busy} onClick={() => void submit("test")}>{busy === "test" ? "Sending…" : "Send test to me"}</button>
        <button className="btn btn-dark" type="button" disabled={!!busy} onClick={() => void submit("send")}>{busy === "send" ? "Sending…" : scheduledAt ? "Schedule" : "Send to subscribers"}</button>
      </div>
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}
