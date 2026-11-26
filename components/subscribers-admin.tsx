"use client";

import { useEffect, useState } from "react";
import PremiumSelect from "./premium-select";

type Subscriber = { id: string; email: string; name: string; subscribedAt: string; unsubscribed: boolean; pending: boolean };

export default function SubscribersAdmin() {
  const [subscribers, setSubscribers] = useState<Subscriber[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [cutoff, setCutoff] = useState(0);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!(event.target as Element).closest?.(".admin-kebab")) setMenuId(null);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  async function deleteSubscriber(subscriber: Subscriber) {
    setMenuId(null);
    if (!window.confirm(`Delete ${subscriber.email} entirely? They will be unsubscribed and removed from the list.`)) return;
    setBusyId(subscriber.id);
    setError("");
    const res = await fetch("/api/admin/subscribers", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: subscriber.id, email: subscriber.email }),
    }).catch(() => null);
    setBusyId(null);
    if (!res?.ok) return setError("Unable to delete subscriber.");
    setSubscribers((list) => list && list.filter((s) => s.id !== subscriber.id));
  }

  async function setUnsubscribed(subscriber: Subscriber, unsubscribed: boolean) {
    setMenuId(null);
    if (unsubscribed && !window.confirm(`Unsubscribe ${subscriber.email}?`)) return;
    setBusyId(subscriber.id);
    setError("");
    const res = await fetch("/api/admin/subscribers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: subscriber.id, email: subscriber.email, unsubscribed }),
    }).catch(() => null);
    setBusyId(null);
    if (!res?.ok) return setError("Unable to update subscriber.");
    setSubscribers((list) => list && list.map((s) => (s.id === subscriber.id ? { ...s, unsubscribed, pending: false } : s)));
  }

  useEffect(() => {
    fetch("/api/admin/subscribers")
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || "Unable to load subscribers.");
        setSubscribers(data.subscribers);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Unable to load subscribers."));
  }, []);

  const term = query.trim().toLowerCase();
  const statusOf = (s: Subscriber) => (s.pending ? "pending" : s.unsubscribed ? "unsubscribed" : "subscribed");
  const rows = (subscribers || []).filter(
    (s) =>
      (!term || s.email.toLowerCase().includes(term)) &&
      (statusFilter === "all" || statusOf(s) === statusFilter) &&
      (!cutoff || new Date(s.subscribedAt).getTime() >= cutoff),
  );

  return (
    <div className="admin-subscribers">
      {(error || subscribers === null) && <p>{error || "Loading subscribers…"}</p>}
      {subscribers && subscribers.length > 0 && (
        <div className="field">
          <label htmlFor="subscriber-search">Search</label>
          <input id="subscriber-search" placeholder="Email" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      )}
      {subscribers && subscribers.length > 0 && (
        <div className="admin-enquiry-filters">
          <div className="admin-enquiry-filter">
            <span id="subscriber-status-filter-label">Status</span>
            <PremiumSelect
              labelId="subscriber-status-filter-label"
              value={statusFilter}
              options={[
                { value: "all", label: "All statuses" },
                { value: "subscribed", label: "Subscribed" },
                { value: "pending", label: "Pending" },
                { value: "unsubscribed", label: "Unsubscribed" },
              ]}
              placeholder="All statuses"
              onChange={setStatusFilter}
            />
          </div>
          <div className="admin-enquiry-filter">
            <span id="subscriber-date-filter-label">Date subscribed</span>
            <PremiumSelect
              labelId="subscriber-date-filter-label"
              value={dateFilter}
              options={[
                { value: "all", label: "Any time" },
                { value: "7", label: "Last 7 days" },
                { value: "30", label: "Last 30 days" },
                { value: "90", label: "Last 90 days" },
                { value: "365", label: "Last 12 months" },
              ]}
              placeholder="Any time"
              onChange={(value) => { setDateFilter(value); setCutoff(value === "all" ? 0 : Date.now() - Number(value) * 86400000); }}
            />
          </div>
          {(statusFilter !== "all" || dateFilter !== "all") && (
            <button type="button" className="admin-filter-reset" onClick={() => { setStatusFilter("all"); setDateFilter("all"); setCutoff(0); }}>
              Reset filters
            </button>
          )}
          <span className="admin-subscribers-total">Total: {rows.length}</span>
        </div>
      )}
      {subscribers && (
        <table className="table admin-stack-table">
          <thead>
            <tr><th>Email</th><th>Subscribed</th><th>Status</th><th aria-label="Actions" /></tr>
          </thead>
          <tbody>
            {rows.length ? rows.map((s) => (
              <tr key={s.id}>
                <td data-label="Email">{s.email}</td>
                <td data-label="Subscribed">{new Date(s.subscribedAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}</td>
                <td data-label="Status">{s.pending ? "Pending" : s.unsubscribed ? "Unsubscribed" : "Subscribed"}</td>
                <td className="admin-table-action">
                  <div className="admin-kebab">
                    <button
                      aria-expanded={menuId === s.id}
                      aria-haspopup="menu"
                      aria-label="Subscriber actions"
                      className="admin-kebab-trigger"
                      disabled={busyId === s.id}
                      type="button"
                      onClick={() => setMenuId((current) => (current === s.id ? null : s.id))}
                    >
                      <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
                        <circle cx="12" cy="5" r="1.8" fill="currentColor" />
                        <circle cx="12" cy="12" r="1.8" fill="currentColor" />
                        <circle cx="12" cy="19" r="1.8" fill="currentColor" />
                      </svg>
                    </button>
                    {menuId === s.id && (
                      <div className="admin-kebab-menu" role="menu">
                        {s.pending ? null : s.unsubscribed ? (
                          <button role="menuitem" type="button" onClick={() => void setUnsubscribed(s, false)}>Resubscribe</button>
                        ) : (
                          <button className="is-danger" role="menuitem" type="button" onClick={() => void setUnsubscribed(s, true)}>Unsubscribe</button>
                        )}
                        <button className="is-danger" role="menuitem" type="button" onClick={() => void deleteSubscriber(s)}>Delete</button>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            )) : (
              <tr><td colSpan={4}>{subscribers.length ? "No subscribers match your filters." : "No subscribers yet."}</td></tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
