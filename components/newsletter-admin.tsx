"use client";

import { useEffect, useRef, useState } from "react";
import CrumbLoader from "./crumb-loader";
import { DatePicker } from "./date-picker";
import { TimePicker } from "./time-picker";

type NewsletterImage = { src: string; after: number };
type Sent = { id: string; name: string | null; status: string; createdAt: string; scheduledAt: string | null; sentAt: string | null };
const normalizeUrl = (u: string) => { const t = u.trim(); return t && !/^https?:\/\//i.test(t) ? `https://${t}` : t; };

type Draft = { id: string; subject: string; body: string; buttonLabel: string; buttonUrl: string; images?: NewsletterImage[]; scheduledAt: string; updatedAt: string };
type Viewing = { subject: string; html: string } | "loading" | "error" | null;

function withLegacyImages(body: string, images: NewsletterImage[]) {
  const parts = body.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  const out: string[] = [];
  const at = (n: number) => images.forEach((img, i) => { if ((img.after < 0 || img.after > parts.length ? parts.length : img.after) === n) out.push(`[image ${i + 1}]`); });
  at(0);
  parts.forEach((part, i) => { out.push(part); at(i + 1); });
  return out.join("\n\n");
}

const fmtDate = (value: string) => new Date(value).toLocaleString("en-AU", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).replace(" at ", ", ");

export default function NewsletterAdmin({ onSuccess, composing, onClose, onOpen }: { onSuccess?: (message: string) => void; composing: boolean; onClose: () => void; onOpen: () => void }) {
  const [subscribers, setSubscribers] = useState<number | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [buttonLabel, setButtonLabel] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [schedDate, setSchedDate] = useState("");
  const [schedTime, setSchedTime] = useState("");
  const scheduledAt = schedDate ? (schedTime ? `${schedDate}T${schedTime}` : schedDate) : "";
  const [images, setImages] = useState<NewsletterImage[]>([]);
  const [uploading, setUploading] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [busy, setBusy] = useState<"" | "test" | "send" | "draft">("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [draftId, setDraftId] = useState("");
  const [notice, setNotice] = useState("");
  const [imageError, setImageError] = useState("");
  const [history, setHistory] = useState<Sent[] | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [viewing, setViewing] = useState<Viewing>(null);
  const [fieldErrors, setFieldErrors] = useState<{ subject?: string; body?: string; time?: string; buttonLabel?: string; buttonUrl?: string }>({});

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
    setSchedDate("");
    setSchedTime("");
    setImages([]);
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
    const legacy = draft.images || [];
    setBody(legacy.length && !/\[image \d+\]/.test(draft.body) ? withLegacyImages(draft.body, legacy) : draft.body);
    setButtonLabel(draft.buttonLabel);
    setButtonUrl(draft.buttonUrl);
    setSchedDate(draft.scheduledAt.slice(0, 10));
    setSchedTime(draft.scheduledAt.slice(11, 16));
    setImages(legacy);
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
    if (!validate(false)) return;
    setBusy("draft");
    setNotice("");
    const res = await fetch("/api/admin/newsletter/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: draftId, subject, body, buttonLabel, buttonUrl, images, scheduledAt }),
    }).catch(() => null);
    setBusy("");
    const data = await res?.json().catch(() => null);
    if (!res?.ok) return setNotice(data?.error || "Unable to save draft.");
    onSuccess?.("Draft saved.");
    onClose();
    resetForm();
    loadDrafts();
  }

  async function shrink(file: File) {
    if (file.type === "image/gif") return file;
    try {
      const bitmap = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      if (scale === 1 && file.size < 1_500_000) return file;
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const type = file.type === "image/png" ? "image/png" : "image/jpeg";
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.86));
      return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.\w+$/, type === "image/png" ? ".png" : ".jpg"), { type }) : file;
    } catch {
      return file;
    }
  }

  function insertAtCursor(text: string, at?: { start: number; end: number }) {
    const el = bodyRef.current;
    const start = at?.start ?? el?.selectionStart ?? body.length;
    const end = at?.end ?? el?.selectionEnd ?? body.length;
    setBody((current) => {
      const before = current.slice(0, start);
      const after = current.slice(end);
      const lead = !before ? "" : before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
      const trail = !after ? "" : after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
      const caret = (before + lead + text + trail).length;
      requestAnimationFrame(() => { bodyRef.current?.focus(); bodyRef.current?.setSelectionRange(caret, caret); });
      return before + lead + text + trail + after;
    });
    setFieldErrors((f) => ({ ...f, body: undefined }));
  }

  async function uploadImages(list: FileList | File[], at?: { start: number; end: number }) {
    const picked = Array.from(list);
    const files = picked.filter((f) => /^image\/(jpeg|png|gif|webp)$/.test(f.type)).slice(0, 6 - images.length);
    if (!files.length) return setImageError(images.length >= 6 ? "Up to 6 images" : "Use JPG, PNG, GIF or WebP images");
    setUploading(true);
    setImageError("");
    const form = new FormData();
    (await Promise.all(files.map(shrink))).forEach((f) => form.append("files", f));
    const res = await fetch("/api/admin/newsletter/images", { method: "POST", body: form }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setUploading(false);
    if (!res?.ok) return setImageError(data?.error || (res?.status === 413 ? "Images are too large" : "Unable to upload images"));
    if (picked.length > files.length) setImageError("Some files were skipped (only JPG, PNG, GIF or WebP, up to 6 images)");
    const urls = data.urls as string[];
    const start = images.length;
    setImages((current) => [...current, ...urls.map((src) => ({ src, after: -1 }))].slice(0, 6));
    insertAtCursor(urls.map((_, i) => `[image ${start + i + 1}]`).join("\n\n"), at);
  }

  function removeImage(n: number) {
    setImages((current) => current.filter((_, i) => i !== n - 1));
    setBody((current) => current
      .replace(/\[image (\d+)\]/g, (_, d) => (Number(d) === n ? "\u0000" : `[image ${Number(d) > n ? Number(d) - 1 : d}]`))
      .replace(/\n*\u0000\n*/g, "\n\n")
      .replace(/^\n+|\n+$/g, ""));
  }

  async function view(id: string) {
    setViewing("loading");
    const res = await fetch(`/api/admin/newsletter/history?id=${encodeURIComponent(id)}`).catch(() => null);
    const data = await res?.json().catch(() => null);
    setViewing(res?.ok && data ? data : "error");
  }

  function validate(full: boolean) {
    const errors: { subject?: string; body?: string; time?: string; buttonLabel?: string; buttonUrl?: string } = {};
    if (!subject.trim()) errors.subject = "Add a subject";
    if (full && !body.trim()) errors.body = "Add a message";
    if (full && schedDate && !schedTime) errors.time = "Choose a send time";
    if (buttonLabel.trim() && !buttonUrl.trim()) errors.buttonUrl = "Add a button link";
    else if (buttonUrl.trim() && !/^(https?:\/\/)?[^\s.\/]+(\.[^\s.\/]+)+\S*$/i.test(buttonUrl.trim())) errors.buttonUrl = "Enter a valid link, e.g. https://clubcrumbie.com";
    if (buttonUrl.trim() && !buttonLabel.trim()) errors.buttonLabel = "Add button text";
    setFieldErrors(errors);
    const first = (["subject", "body", "buttonLabel", "buttonUrl", "time"] as const).find((k) => errors[k]);
    if (!first) return true;
    const target = document.getElementById({ subject: "nl-subject", body: "nl-body", buttonLabel: "nl-button-label", buttonUrl: "nl-button-url", time: "nl-schedule-time" }[first]);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target?.focus({ preventScroll: true });
    return false;
  }

  async function submit(mode: "test" | "send") {
    if (!validate(true)) return;
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
        buttonUrl: normalizeUrl(buttonUrl),
        images,
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
        <CrumbLoader label="Loading newsletters" />
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
              <CrumbLoader />
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
              <input id="nl-subject" maxLength={200} aria-invalid={!!fieldErrors.subject} value={subject} onChange={(e) => { setSubject(e.target.value); setFieldErrors((f) => ({ ...f, subject: undefined })); }} />
              {fieldErrors.subject && <p className="field-error" role="alert">{fieldErrors.subject}</p>}
            </label>
            <label className={`field${fieldErrors.body ? " has-error" : ""}`}>
              <span>Message</span>
              <textarea id="nl-body" ref={bodyRef} rows={8} maxLength={10000} onPaste={(e) => { const files = Array.from(e.clipboardData.files); if (files.length) { e.preventDefault(); void uploadImages(files, { start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd }); } }} onDrop={(e) => { if (e.dataTransfer.files.length) { e.preventDefault(); void uploadImages(e.dataTransfer.files, { start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd }); } }} aria-invalid={!!fieldErrors.body} value={body} onChange={(e) => { setBody(e.target.value); setFieldErrors((f) => ({ ...f, body: undefined })); }} />
              {fieldErrors.body && <p className="field-error" role="alert">{fieldErrors.body}</p>}
              <small className="admin-newsletter-hint">Leave a blank line between paragraphs. Drop or paste a photo to place it at the cursor. An unsubscribe link is added automatically.</small>
            </label>
            <div className="field">
              <span>Photos (optional)</span>
              <div className="admin-newsletter-photos">
                {images.map((image, i) => (
                  <div key={image.src} className="admin-newsletter-image-thumb" title={`[image ${i + 1}]`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.src} alt="" />
                    <em>{i + 1}</em>
                    <button type="button" aria-label={`Remove image ${i + 1}`} onClick={() => removeImage(i + 1)}>×</button>
                  </div>
                ))}
                {images.length < 6 && (
                  <button className="admin-newsletter-add-photo" type="button" disabled={uploading} onClick={() => document.getElementById("nl-images")?.click()}>
                    {uploading ? "Uploading…" : "+ Add photo"}
                  </button>
                )}
                <input id="nl-images" className="sr-only" type="file" accept="image/jpeg,image/png,image/gif,image/webp" multiple onChange={(e) => { if (e.target.files) void uploadImages(e.target.files); e.target.value = ""; }} />
              </div>
              {imageError && <p className="field-error" role="alert">{imageError}</p>}
              <small className="admin-newsletter-hint">Photos appear in the message as [image 1], [image 2]… Move or delete the tag to reposition it.</small>
            </div>
            <label className={`field admin-newsletter-half${fieldErrors.buttonLabel ? " has-error" : ""}`}>
              <span>Button text (optional)</span>
              <input id="nl-button-label" maxLength={60} placeholder="Order now" aria-invalid={!!fieldErrors.buttonLabel} value={buttonLabel} onChange={(e) => { setButtonLabel(e.target.value); setFieldErrors((f) => ({ ...f, buttonLabel: undefined, buttonUrl: undefined })); }} />
              {fieldErrors.buttonLabel && <p className="field-error" role="alert">{fieldErrors.buttonLabel}</p>}
            </label>
            <label className={`field admin-newsletter-half${fieldErrors.buttonUrl ? " has-error" : ""}`}>
              <span>Button link (optional)</span>
              <input id="nl-button-url" type="text" inputMode="url" placeholder="https://clubcrumbie.com" aria-invalid={!!fieldErrors.buttonUrl} value={buttonUrl} onChange={(e) => { setButtonUrl(e.target.value); setFieldErrors((f) => ({ ...f, buttonUrl: undefined, buttonLabel: undefined })); }} />
              {fieldErrors.buttonUrl && <p className="field-error" role="alert">{fieldErrors.buttonUrl}</p>}
            </label>
<div className="admin-time-range">
              <div className="field">
                <label htmlFor="nl-schedule-date">Schedule date (optional)</label>
                <DatePicker key={draftId || "new"} id="nl-schedule-date" value={schedDate} onChange={(date) => { setSchedDate(date); setFieldErrors((e) => ({ ...e, time: undefined })); }} />
              </div>
              <div className={`field${fieldErrors.time ? " has-error" : ""}`}>
                <label htmlFor="nl-schedule-time">{schedDate ? "Send time" : "Send time (optional)"}</label>
                <TimePicker id="nl-schedule-time" label="Send time" required={!!schedDate} value={schedTime} onChange={(time) => { setSchedTime(time); setFieldErrors((e) => ({ ...e, time: undefined })); }} />
                {fieldErrors.time && <p className="field-error" role="alert">{fieldErrors.time}</p>}
              </div>
            </div>
            <small className="admin-newsletter-hint">Leave the date blank to send now.</small>
            {notice && <p role="status">{notice}</p>}
      <div className="admin-newsletter-modal-actions">
        <button className="btn btn-light" type="button" disabled={!!busy} onClick={close}>Cancel</button>
        <button className={`btn btn-light${busy === "draft" ? " btn-loading" : ""}`} type="button" disabled={!!busy} onClick={() => void saveDraft()}>{busy === "draft" && <span className="btn-spinner" aria-hidden="true" />}Save draft</button>
        <button className={`btn btn-light${busy === "test" ? " btn-loading" : ""}`} type="button" disabled={!!busy} onClick={() => void submit("test")}>{busy === "test" && <span className="btn-spinner" aria-hidden="true" />}Send test</button>
        <button className={`btn btn-dark${busy === "send" ? " btn-loading" : ""}`} type="button" disabled={!!busy} onClick={() => void submit("send")}>{busy === "send" && <span className="btn-spinner" aria-hidden="true" />}{scheduledAt ? "Schedule" : "Send to subscribers"}</button>
      </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
