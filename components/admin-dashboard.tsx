"use client";

import { useEffect, useState } from "react";

type Data = { orders: Array<Record<string, unknown>>; enquiries: Array<Record<string, unknown>> };
type Order = { id?: string; createdAt?: string; customer?: { name?: string; email?: string }; paymentStatus?: string; lines?: Array<{ productName?: string; variantLabel?: string; pickupDate?: string; pickupWindow?: string; status?: string }> };
type Enquiry = { id?: string; name?: string; email?: string; phone?: string; request?: string; status?: string };

const adminTabs = ["orders", "pickup schedule", "enquiries", "products", "pickup dates", "homepage", "about", "testimonials", "policy", "email templates", "settings"];

export default function AdminDashboard() {
  const [password, setPassword] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("orders");

  async function load() {
    const response = await fetch("/api/admin/dashboard");
    if (response.ok) {
      setData(await response.json());
    }
  }

  useEffect(() => {
    void fetch("/api/admin/dashboard").then(async (response) => {
      if (response.ok) setData(await response.json());
    });
  }, []);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    if (!response.ok) { setError("Incorrect password."); return; }
    setPassword("");
    await load();
  }

  if (!data) return (
    <form className="form-card" onSubmit={login} style={{ maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ fontSize: "2.4rem" }}>Sign in</h1>
      <div className="field"><label htmlFor="password">Password</label><input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
      <button className="btn btn-dark">Sign in</button>
      {error && <p className="field-error">{error}</p>}
    </form>
  );

  const orders = data.orders as Order[];
  const enquiries = data.enquiries as Enquiry[];
  const pickupDates = Array.from(new Set(orders.flatMap((order) => order.lines?.map((line) => line.pickupDate) || [])));

  return (
    <div className="admin-grid">
      <aside className="admin-nav">{adminTabs.map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</aside>
      <section>
        <h1 style={{ fontSize: "3rem", marginTop: 8, textTransform: "capitalize" }}>{tab}</h1>
        {tab === "orders" && <table className="table"><thead><tr><th>Customer</th><th>Items</th><th>Payment</th><th>Created</th></tr></thead><tbody>{orders.length ? orders.map((order) => <tr key={order.id}><td>{order.customer?.name}<br /><small>{order.customer?.email}</small></td><td>{order.lines?.map((line, index) => <div key={index}>{line.productName} · {line.variantLabel} <span className="status">{line.status}</span></div>)}</td><td>{order.paymentStatus}</td><td>{order.createdAt?.slice(0, 10)}</td></tr>) : <tr><td colSpan={4}>No orders yet.</td></tr>}</tbody></table>}
        {tab === "pickup schedule" && <div>{pickupDates.map((date) => <div className="form-card" key={date} style={{ marginBottom: 14 }}><h2>{date}</h2>{orders.flatMap((order) => (order.lines || []).filter((line) => line.pickupDate === date).map((line, index) => <p key={`${order.id}-${index}`}>{order.customer?.name} · {line.productName} · {line.pickupWindow}</p>))}<button className="btn btn-dark" disabled>Bulk ready email (configure Resend)</button></div>)}</div>}
        {tab === "enquiries" && <table className="table"><thead><tr><th>Name</th><th>Request</th><th>Status</th></tr></thead><tbody>{enquiries.length ? enquiries.map((enquiry) => <tr key={enquiry.id}><td>{enquiry.name}<br /><small>{enquiry.email}<br />{enquiry.phone}</small></td><td>{enquiry.request}</td><td><span className="status">{enquiry.status}</span></td></tr>) : <tr><td colSpan={3}>No enquiries yet.</td></tr>}</tbody></table>}
        {!['orders', 'pickup schedule', 'enquiries'].includes(tab) && <div className="notice"><strong>Admin module scaffolded.</strong><br />This area is prepared for the named content type. Content management will be available once Redis and R2 are connected.</div>}
      </section>
    </div>
  );
}
