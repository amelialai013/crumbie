"use client";

import { useEffect, useState } from "react";

type Sent = { id: string; name: string | null; status: string; createdAt: string; scheduledAt: string | null; sentAt: string | null };
type Draft = { id: string; subject: string; body: string; buttonLabel: string; buttonUrl: string; scheduledAt: string; updatedAt: string };
type Viewing = { subject: string; html: string } | "loading" | "error" | null;

const fmtDate = (value: string) => new Date(value).toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).replace(" at ", ", ");

export default function NewsletterAdmin({ onSuccess, composing, onClose, onOpen }: { onSuccess?: (message: string) => void; composing: boolean; onClose: () => void; onOpen: () => void }) {
  const [subscribers, setSubscribers] = useState<number | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [buttonLabel, setButtonLabel] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [busy, setBusy] = useState<"" | "test" | "send" | "draft">("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftId, setDraftId] = useState("");
  const [notice, setNotice] = useState("");
  const [history, setHistory] = useState<Sent[] | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [viewing, setViewing] = useState<Viewing>(null);
  const [fieldErrors, setFieldErrors] = useState<{ subject?: string; body?: string }>({});

  useEffect(() => {
    fetch("/api/admin/newsletter")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setSubscribers(typeof data?.subscribers === "number" ? data.subscribers : null))
      .catch(() => null);
  }, []);

  useEffect(() => {
    const closeMenu = (event: MouseEvent) => {
      if (!(event.target as Element).closest?.(".admin-kebab")) setMenuId(null);
    };
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, []);

  function loadHistory() {
    fetch("/api/admin/newsletter/history")
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || "Unable to load newsletters.");
        setHistory(data.newsletters);
      })
      .catch((e) => setHistoryError(e instanceof Error ? e.message : "Unable to load newsletters."));
  }

  useEffect(loadHistory, []);

  function loadDrafts() {
    fetch("/api/admin/newsletter/drafts")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setDrafts(Array.isArray(data?.drafts) ? data.drafts : []))
      .catch(() => null);
  }

  useEffect(loadDrafts, []);

  function resetForm() {
    setDraftId("");
    setSubject("");
    setBody("");
    setButtonLabel("");
    setButtonUrl("");
    setScheduledAt("");
    setFieldErrors({});
    setNotice("");
  }

  function close() {
    onClose();
    if (draftId) resetForm();
  }

  function editDraft(draft: Draft) {
    setDraftId(draft.id);
    setSubject(draft.subject);
    setBody(draft.body);
    setButtonLabel(draft.buttonLabel);
    setButtonUrl(draft.buttonUrl);
    setScheduledAt(draft.scheduledAt);
    setFieldErrors({});
    setNotice("");
    onOpen();
  }

  async function removeDraft(id: string) {
    if (!window.confirm("Delete this draft?")) return;
    const res = await fetch(`/api/admin/newsletter/drafts?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
    if (res?.ok) {
      setDrafts((list) => list.filter((d) => d.id !== id));
      onSuccess?.("Draft deleted.");
    }
  }

  async function saveDraft() {
    setBusy("draft");
    setNotice("");
    const res = await fetch("/api/admin/newsletter/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: draftId, subject, body, buttonLabel, buttonUrl, scheduledAt }),
    }).catch(() => null);
    setBusy("");
    const data = await res?.json().catch(() => null);
    if (!res?.ok) return setNotice(data?.error || "Unable to save draft.");
    onSuccess?.("Draft saved.");
    onClose();
    resetForm();
    loadDrafts();
  }

  async function view(id: string) {
    setViewing("loading");
    const res = await fetch(`/api/admin/newsletter/history?id=${encodeURIComponent(id)}`).catch(() => null);
    const data = await res?.json().catch(() => null);
    setViewing(res?.ok && data ? data : "error");
  }

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
      if (draftId) {
        await fetch(`/api/admin/newsletter/drafts?id=${encodeURIComponent(draftId)}`, { method: "DELETE" }).catch(() => null);
        loadDrafts();
      }
      onClose();
      loadHistory();
      resetForm();
    }
  }

  return (
    <div className="admin-newsletter">
      {historyError ? (
        <p>{historyError}</p>
      ) : history === null ? (
        <p>Loading newsletters…</p>
      ) : (
        <table className="table admin-stack-table">
          <thead>
            <tr><th>Subject</th><th>Date</th><th>Status</th><th aria-label="Actions" /></tr>
          </thead>
          <tbody>
            {drafts.map((d) => (
              <tr key={d.id}>
                <td data-label="Subject">{d.subject || "(No subject)"}</td>
                <td data-label="Date">{fmtDate(d.updatedAt)}</td>
                <td data-label="Status">Draft</td>
                <td className="admin-table-action">
                  <div className="admin-kebab">
                    <button aria-expanded={menuId === d.id} aria-haspopup="menu" aria-label="Draft actions" className="admin-kebab-trigger" type="button" onClick={() => setMenuId((current) => (current === d.id ? null : d.id))}>
                      <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
                        <circle cx="12" cy="5" r="1.8" fill="currentColor" />
                        <circle cx="12" cy="12" r="1.8" fill="currentColor" />
                        <circle cx="12" cy="19" r="1.8" fill="currentColor" />
                      </svg>
                    </button>
                    {menuId === d.id && (
                      <div className="admin-kebab-menu" role="menu">
                        <button role="menuitem" type="button" onClick={() => { setMenuId(null); editDraft(d); }}>Edit</button>
                        <button className="is-danger" role="menuitem" type="button" onClick={() => { setMenuId(null); void removeDraft(d.id); }}>Delete</button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {history.length || drafts.length ? history.map((n) => {
              const when = n.sentAt || n.scheduledAt || n.createdAt;
              const status = n.sentAt ? "Sent" : n.status === "queued" ? "Scheduled" : n.status === "draft" ? "Draft" : n.status.charAt(0).toUpperCase() + n.status.slice(1);
              return (
                <tr key={n.id}>
                  <td data-label="Subject">{n.name || "(No subject)"}</td>
                  <td data-label="Date">{fmtDate(when)}</td>
                  <td data-label="Status">{status}</td>
                  <td className="admin-table-action"><div className="admin-kebab">
                    <button aria-expanded={menuId === n.id} aria-haspopup="menu" aria-label="Newsletter actions" className="admin-kebab-trigger" type="button" onClick={() => setMenuId((current) => (current === n.id ? null : n.id))}>
                      <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
                        <circle cx="12" cy="5" r="1.8" fill="currentColor" />
                        <circle cx="12" cy="12" r="1.8" fill="currentColor" />
                        <circle cx="12" cy="19" r="1.8" fill="currentColor" />
                      </svg>
                    </button>
                    {menuId === n.id && (
                      <div className="admin-kebab-menu" role="menu">
                        <button role="menuitem" type="button" onClick={() => { setMenuId(null); void view(n.id); }}>View</button>
                      </div>
                    )}
                  </div></td>
                </tr>
              );
            }) : (
              <tr><td colSpan={4}>No newsletters sent yet.</td></tr>
            )}
          </tbody>
        </table>
      )}
      {viewing && (
        <div className="admin-confirm-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) setViewing(null); }}>
          <div className="admin-confirm-modal admin-newsletter-view" role="dialog" aria-modal="true" aria-label="Newsletter">
            {viewing === "loading" ? (
              <p>Loading…</p>
            ) : viewing === "error" ? (
              <p>Unable to load this newsletter.</p>
            ) : (
              <>
                <h2>{viewing.subject}</h2>
                <div className="admin-newsletter-preview" dangerouslySetInnerHTML={{ __html: viewing.html }} />
              </>
            )}
            <div className="admin-confirm-actions">
              <button className="btn btn-light" type="button" onClick={() => setViewing(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
      {composing && (
        <div className="admin-confirm-overlay" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) close(); }}>
          <div className="admin-newsletter-modal" role="dialog" aria-modal="true" aria-label="Create newsletter">
            <div className="admin-modal-header">
              <h2>Create newsletter</h2>
              <button className="btn btn-light admin-product-close" type="button" aria-label="Close modal" title="Close" disabled={!!busy} onClick={close}>
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none"><path d="m5 5 10 10M15 5 5 15" /></svg>
              </button>
            </div>
            <div className="admin-modal-body">
            <label className={`field${fieldErrors.subject ? " has-error" : ""}`}>
              <span>Subject</span>
              <input maxLength={200} aria-invalid={!!fieldErrors.subject} value={subject} onChange={(e) => { setSubject(e.target.value); setFieldErrors((f) => ({ ...f, subject: undefined })); }} />
              {fieldErrors.subject && <small className="admin-reply-error" role="alert">{fieldErrors.subject}</small>}
            </label>
            <label className={`field${fieldErrors.body ? " has-error" : ""}`}>
              <span>Message</span>
              <textarea rows={8} maxLength={10000} aria-invalid={!!fieldErrors.body} value={body} onChange={(e) => { setBody(e.target.value); setFieldErrors((f) => ({ ...f, body: undefined })); }} />
              {fieldErrors.body && <small className="admin-reply-error" role="alert">{fieldErrors.body}</small>}
              <small className="admin-newsletter-hint">Leave a blank line between paragraphs. An unsubscribe link is added automatically.</small>
            </label>
            <label className="field">
              <span>Button text (optional)</span>
              <input maxLength={60} placeholder="Order now" value={buttonLabel} onChange={(e) => setButtonLabel(e.target.value)} />
            </label>
            <label className="field">
              <span>Button link (optional)</span>
              <input type="url" placeholder="https://clubcrumbie.com" value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} />
            </label>
            <label className="field">
              <span>Schedule (optional, leave blank to send now)</span>
              <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
            </label>
            {notice && <p role="status">{notice}</p>}
            </div>
      <div className="admin-newsletter-modal-actions">
        <button className="btn btn-light" type="button" disabled={!!busy} onClick={close}>Cancel</button>
        <button className="btn btn-light" type="button" disabled={!!busy} onClick={() => void saveDraft()}>{busy === "draft" ? "Saving…" : "Save draft"}</button>
        <button className="btn btn-light" type="button" disabled={!!busy} onClick={() => void submit("test")}>{busy === "test" ? "Sending…" : "Send test"}</button>
        <button className="btn btn-dark" type="button" disabled={!!busy} onClick={() => void submit("send")}>{busy === "send" ? "Sending…" : scheduledAt ? "Schedule" : "Send to subscribers"}</button>
      </div>
          </div>
        </div>
      )}
    </div>
  );
}
