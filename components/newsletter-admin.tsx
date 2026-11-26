"use client";

import { useEffect, useState } from "react";

export default function NewsletterAdmin() {
  const [subscribers, setSubscribers] = useState<number | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [buttonLabel, setButtonLabel] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [busy, setBusy] = useState<"" | "test" | "send">("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/admin/newsletter")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setSubscribers(typeof data?.subscribers === "number" ? data.subscribers : null))
      .catch(() => null);
  }, []);

  async function submit(mode: "test" | "send") {
    if (!subject.trim() || !body.trim()) {
      setNotice("Add a subject and message.");
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
    setNotice(mode === "test" ? "Test sent to the admin inbox." : scheduledAt ? "Newsletter scheduled." : "Newsletter sent.");
    if (mode === "send") {
      setSubject("");
      setBody("");
      setButtonLabel("");
      setButtonUrl("");
      setScheduledAt("");
    }
  }

  return (
    <div className="admin-newsletter">
      <p>{subscribers === null ? "Loading subscribers…" : `${subscribers} confirmed subscriber${subscribers === 1 ? "" : "s"}`}</p>
      <div className="field">
        <label htmlFor="nl-subject">Subject</label>
        <input id="nl-subject" maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="nl-body">Message</label>
        <textarea id="nl-body" className="admin-textarea-lines" style={{ "--lines": 10 } as React.CSSProperties} value={body} onChange={(e) => setBody(e.target.value)} />
        <small className="admin-editor-count">Leave a blank line between paragraphs. An unsubscribe link is added automatically.</small>
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
