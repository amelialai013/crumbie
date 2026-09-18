"use client";

import { useEffect, useState } from "react";
import {
  isDateClosed,
  pickupDates as catalogPickupDates,
  products,
  type Product,
} from "@/lib/catalog";

type Data = {
  orders: Array<Record<string, unknown>>;
  enquiries: Array<Record<string, unknown>>;
};
type Order = {
  id?: string;
  createdAt?: string;
  customer?: { name?: string; email?: string };
  paymentStatus?: string;
  lines?: Array<{
    productName?: string;
    variantLabel?: string;
    pickupDate?: string;
    pickupWindow?: string;
    status?: string;
  }>;
};
type Enquiry = {
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  request?: string;
  status?: string;
};
type PolicySection = { heading: string; body: string };
type Content = {
  fields: Record<string, string>;
  sections?: PolicySection[];
  removedFields?: string[];
};
type Config = {
  store: boolean;
  stripe: boolean;
  resend: boolean;
  r2: boolean;
  session: boolean;
};
type ContentField = {
  key: string;
  label: string;
  maxLength: number;
  multiline?: boolean;
};
type ContentModule = { fields: ContentField[]; defaults?: Content };
type PickupDate = {
  id: string;
  date: string;
  window: string;
  soldOut?: boolean;
};
type PickupFilter = "all" | "closed" | "open";
type EmailTemplate = { key: string; name: string; description: string; subjectField: string; bodyField: string };

const adminTabs = [
  "orders",
  "pickup schedule",
  "enquiries",
  "products",
  "pickup dates",
  "homepage",
  "about",
  "contact us",
  "policy",
  "email templates",
  "settings",
];
const emailTemplates: EmailTemplate[] = [
  { key: "confirmation", name: "Order confirmation", description: "Sent immediately after a successful order.", subjectField: "confirmationSubject", bodyField: "confirmationBody" },
  { key: "pickupReminder", name: "Pickup reminder", description: "Sent before a customer pickup with date, time, and collection information.", subjectField: "pickupReminderSubject", bodyField: "pickupReminderBody" },
  { key: "enquiryNotification", name: "Enquiry notification", description: "Sent when a customer submits the Contact Us form.", subjectField: "enquirySubject", bodyField: "enquiryBody" },
];

function productSlug(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
const contentModules: Record<string, ContentModule> = {
  homepage: {
    fields: [
      { key: "heroPrimaryLabel", label: "Primary button label", maxLength: 40 },
      {
        key: "heroSecondaryLabel",
        label: "Secondary button label",
        maxLength: 40,
      },
      { key: "howTitle", label: "How it works heading", maxLength: 80 },
      { key: "stepOneTitle", label: "Step 1 heading", maxLength: 60 },
      {
        key: "stepOneBody",
        label: "Step 1 body copy",
        maxLength: 180,
        multiline: true,
      },
      { key: "stepTwoTitle", label: "Step 2 heading", maxLength: 60 },
      {
        key: "stepTwoBody",
        label: "Step 2 body copy",
        maxLength: 180,
        multiline: true,
      },
      { key: "stepThreeTitle", label: "Step 3 heading", maxLength: 60 },
      {
        key: "stepThreeBody",
        label: "Step 3 body copy",
        maxLength: 180,
        multiline: true,
      },
      {
        key: "catalogHeading",
        label: "Product section heading",
        maxLength: 100,
      },
    ],
    defaults: {
      fields: {
        heroPrimaryLabel: "Explore crumbs",
        heroSecondaryLabel: "Make an enquiry",
        howTitle: "How it works",
        stepOneTitle: "Choose your box",
        stepOneBody: "Pick a curated collection in a box of six or twelve.",
        stepTwoTitle: "Select pickup",
        stepTwoBody:
          "Choose an available pickup date and time in Ivanhoe, Victoria.",
        stepThreeTitle: "Pay securely",
        stepThreeBody: "Complete payment and receive immediate confirmation.",
        catalogHeading: "Crumbs for every craving",
      },
    },
  },
  about: {
    fields: [
      { key: "pageTitle", label: "Heading", maxLength: 80 },
      { key: "storyHeading", label: "Heading", maxLength: 80 },
      {
        key: "storyCopy",
        label: "Body copy",
        maxLength: 1200,
        multiline: true,
      },
      { key: "batchHeading", label: "Heading", maxLength: 80 },
      { key: "batchCopy", label: "Body copy", maxLength: 800, multiline: true },
    ],
    defaults: {
      fields: {
        pageTitle: "Crumbie beginnings",
        storyHeading: "Our story",
        storyCopy:
          "Club Crumbie began with two girls who love baking and have a shared belief that the best things are made with patience and care. We make considered drops that give each collection room to explore depth, richness and quality. The result is familiar, but made with a little more intention.",
        batchHeading: "Small batch by design",
        batchCopy:
          "Each release is made in small quantities, giving us room to refine every detail and share something fresh, thoughtful and worth returning to.",
      },
    },
  },
  policy: {
    fields: [
      { key: "pageTitle", label: "Page heading", maxLength: 80 },
      { key: "pickupHeading", label: "Section 1 heading", maxLength: 80 },
      {
        key: "pickupCopy",
        label: "Section 1 body copy",
        maxLength: 1000,
        multiline: true,
      },
      { key: "deadlineHeading", label: "Section 2 heading", maxLength: 80 },
      {
        key: "deadlineCopy",
        label: "Section 2 body copy",
        maxLength: 700,
        multiline: true,
      },
      { key: "paymentHeading", label: "Section 3 heading", maxLength: 80 },
      {
        key: "paymentCopy",
        label: "Section 3 body copy",
        maxLength: 700,
        multiline: true,
      },
      { key: "cancellationHeading", label: "Section 4 heading", maxLength: 80 },
      {
        key: "cancellationCopy",
        label: "Section 4 body copy",
        maxLength: 1000,
        multiline: true,
      },
      { key: "allergenHeading", label: "Section 5 heading", maxLength: 80 },
      {
        key: "allergenCopy",
        label: "Section 5 body copy",
        maxLength: 700,
        multiline: true,
      },
      { key: "enquiryHeading", label: "Section 6 heading", maxLength: 80 },
      {
        key: "enquiryCopy",
        label: "Section 6 body copy",
        maxLength: 700,
        multiline: true,
      },
    ],
    defaults: {
      fields: {
        pageTitle: "Crumbie policies",
        pickupHeading: "Pickup",
        pickupCopy:
          "Club Crumbie currently offers pickup only from Ivanhoe, Victoria. Each item must be assigned to an available pickup date and its fixed collection window before checkout. The exact address is provided after successful payment in your confirmation email.",
        deadlineHeading: "Order deadlines",
        deadlineCopy:
          "Standard box orders close 72 hours before their pickup window. A date or individual product may be marked sold out earlier by Club Crumbie.",
        paymentHeading: "Payments",
        paymentCopy:
          "Standard orders are confirmed immediately after successful payment through Stripe. Prices are in Australian dollars and include GST where applicable.",
        cancellationHeading: "Cancellations and refunds",
        cancellationCopy:
          "Because products are made for scheduled pickup, paid orders are final and change-of-mind cancellations are not accepted. Nothing in this policy excludes rights or remedies available under Australian Consumer Law.",
        allergenHeading: "Allergens",
        allergenCopy:
          "Club Crumbie handles gluten, dairy, eggs, soy, peanuts and tree nuts. Cross-contact is possible, and we cannot accommodate allergy requests for standard boxes.",
        enquiryHeading: "Custom enquiries",
        enquiryCopy:
          "A custom-order form submission is an enquiry only. It does not confirm availability, pricing or an order.",
      },
      sections: [],
      removedFields: [],
    },
  },
  "contact us": {
    fields: [
      { key: "pageTitle", label: "Heading", maxLength: 80 },
      {
        key: "messagePrompt",
        label: "Message prompt",
        maxLength: 180,
        multiline: true,
      },
    ],
    defaults: {
      fields: {
        pageTitle: "Get in touch",
        messagePrompt:
          "Tell us how we can help. For custom orders, include the occasion, quantity and timing you have in mind.",
      },
    },
  },
  "email templates": {
    fields: [
      { key: "confirmationSubject", label: "Subject", maxLength: 140 },
      { key: "confirmationBody", label: "Body copy", maxLength: 3000, multiline: true },
      { key: "pickupReminderSubject", label: "Subject", maxLength: 140 },
      { key: "pickupReminderBody", label: "Body copy", maxLength: 3000, multiline: true },
      { key: "enquirySubject", label: "Subject", maxLength: 140 },
      { key: "enquiryBody", label: "Body copy", maxLength: 3000, multiline: true },
    ],
  },
  settings: {
    fields: [
      { key: "pickupAddress", label: "Pickup address", maxLength: 240 },
      { key: "notificationEmail", label: "Notification email", maxLength: 200 },
      { key: "businessName", label: "Business name", maxLength: 100 },
    ],
  },
};

function emptyContent(moduleName: string): Content {
  return (
    contentModules[moduleName]?.defaults || {
      fields: Object.fromEntries(
        (contentModules[moduleName]?.fields || []).map((field) => [
          field.key,
          "",
        ]),
      ),
    }
  );
}

function mergeContent(
  moduleName: string,
  fields: Record<string, string>,
): Content {
  return { fields: { ...emptyContent(moduleName).fields, ...fields } };
}

export default function AdminDashboard() {
  const [password, setPassword] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("orders");
  const [content, setContent] = useState<Content>({ fields: {} });
  const [contentStatus, setContentStatus] = useState("");
  const [config, setConfig] = useState<Config | null>(null);
  const [dashboardError, setDashboardError] = useState("");
  const [managedPickupDates, setManagedPickupDates] =
    useState<PickupDate[]>(catalogPickupDates);
  const [newPickupDate, setNewPickupDate] = useState("");
  const [newPickupWindow, setNewPickupWindow] = useState("10:00am–12:00pm");
  const [pickupDateStatus, setPickupDateStatus] = useState("");
  const [pickupFilter, setPickupFilter] = useState<PickupFilter>("all");
  const [managedProducts, setManagedProducts] = useState<Product[]>(products);
  const [productStatus, setProductStatus] = useState("");
  const [newProduct, setNewProduct] = useState({
    name: "",
    description: "",
    ingredients: "",
    allergens: "",
    price6: "",
    price12: "",
  });
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [emailTemplateKey, setEmailTemplateKey] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/admin/dashboard");
    if (response.ok) {
      setData(await response.json());
      setDashboardError("");
    } else {
      setDashboardError("Your admin session has expired. Sign in again.");
    }
  }

  useEffect(() => {
    void fetch("/api/admin/dashboard").then(async (response) => {
      if (response.ok) {
        setData(await response.json());
        const configResponse = await fetch("/api/admin/config");
        if (configResponse.ok) setConfig(await configResponse.json());
        const pickupDatesResponse = await fetch("/api/admin/pickup-dates");
        if (pickupDatesResponse.ok)
          setManagedPickupDates(await pickupDatesResponse.json());
        const productsResponse = await fetch("/api/admin/products");
        if (productsResponse.ok)
          setManagedProducts(await productsResponse.json());
      }
    });
  }, []);

  async function login(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) {
      setError(
        response.status === 401
          ? "Incorrect password."
          : "Admin session is not configured.",
      );
      return;
    }
    setPassword("");
    await load();
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setData(null);
    setConfig(null);
    setError("");
  }

  async function addPickupDate(event: React.FormEvent) {
    event.preventDefault();
    setPickupDateStatus("Saving...");
    const response = await fetch("/api/admin/pickup-dates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: newPickupDate, window: newPickupWindow }),
    });
    if (!response.ok) {
      setPickupDateStatus(
        (await response.json().catch(() => null))?.error ||
          "Unable to save pickup date",
      );
      return;
    }
    const savedDate = await response.json();
    setManagedPickupDates((current) =>
      [...current.filter((date) => date.id !== savedDate.id), savedDate].sort(
        (left, right) => left.date.localeCompare(right.date),
      ),
    );
    setNewPickupDate("");
    setPickupDateStatus("Pickup date added");
  }

  async function removePickupDate(id: string) {
    setPickupDateStatus("Removing...");
    const response = await fetch(
      `/api/admin/pickup-dates?id=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      setPickupDateStatus(
        (await response.json().catch(() => null))?.error ||
          "Unable to remove pickup date",
      );
      return;
    }
    setManagedPickupDates((current) =>
      current.filter((date) => date.id !== id),
    );
    setPickupDateStatus("Pickup date removed");
  }

  async function addProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProductStatus(editingProductId ? "Saving..." : "Publishing...");
    const formData = new FormData(event.currentTarget);
    const slug = productSlug(newProduct.name);
    const product = {
      id: editingProductId || `product-${slug}`,
      slug,
      name: newProduct.name.trim(),
      description: newProduct.description.trim(),
      ingredients: newProduct.ingredients.trim(),
      allergens: newProduct.allergens.trim(),
      variants: [
        {
          id: `${slug}-6`,
          label: "Box of 6",
          quantity: 6,
          price: Number(newProduct.price6),
        },
        {
          id: `${slug}-12`,
          label: "Box of 12",
          quantity: 12,
          price: Number(newProduct.price12),
        },
      ],
    };
    formData.set("product", JSON.stringify(product));
    const response = await fetch("/api/admin/products", {
      method: "POST",
      body: formData,
    });
    if (!response.ok) {
      setProductStatus(
        (await response.json().catch(() => null))?.error ||
          "Unable to publish product",
      );
      return;
    }
    const savedProduct = await response.json();
    setManagedProducts((current) => [
      ...current.filter((item) => item.id !== savedProduct.id),
      savedProduct,
    ]);
    setNewProduct({
      name: "",
      description: "",
      ingredients: "",
      allergens: "",
      price6: "",
      price12: "",
    });
    setEditingProductId(null);
    event.currentTarget.reset();
    setProductStatus(editingProductId ? "Product saved" : "Product published");
  }

  function editProduct(product: Product) {
    setEditingProductId(product.id);
    setNewProduct({
      name: product.name,
      description: product.description,
      ingredients: product.ingredients,
      allergens: product.allergens,
      price6: String(product.variants.find((variant) => variant.quantity === 6)?.price || ""),
      price12: String(product.variants.find((variant) => variant.quantity === 12)?.price || ""),
    });
    (document.getElementById("product-modal-toggle") as HTMLInputElement).checked = true;
  }

  function startNewProduct() {
    setEditingProductId(null);
    setNewProduct({ name: "", description: "", ingredients: "", allergens: "", price6: "", price12: "" });
  }

  async function removeProduct(id: string) {
    setProductStatus("Removing...");
    const response = await fetch(
      `/api/admin/products?id=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      setProductStatus(
        (await response.json().catch(() => null))?.error ||
          "Unable to remove product",
      );
      return;
    }
    setManagedProducts((current) =>
      current.filter((product) => product.id !== id),
    );
    setProductStatus("Product removed");
  }

  async function selectTab(nextTab: string) {
    setTab(nextTab);
    setEmailTemplateKey(null);
    setContentStatus("");
    if (contentModules[nextTab]) {
      const response = await fetch(
        `/api/admin/content?module=${encodeURIComponent(nextTab)}`,
      );
      if (response.ok) {
        const savedContent = await response.json();
        setContent(
          savedContent.fields
            ? {
                ...mergeContent(nextTab, savedContent.fields),
                sections:
                  savedContent.sections || emptyContent(nextTab).sections,
                removedFields:
                  savedContent.removedFields ||
                  emptyContent(nextTab).removedFields,
              }
            : emptyContent(nextTab),
        );
      } else setContent(emptyContent(nextTab));
    }
  }

  function editEmailTemplate(template: EmailTemplate) {
    setEmailTemplateKey(template.key);
  }

  async function saveContent(event: React.FormEvent) {
    event.preventDefault();
    const contentModule = contentModules[tab];
    if (!contentModule) return;
    if (
      contentModule.fields.some(
        (field) => (content.fields[field.key] || "").length > field.maxLength,
      )
    ) {
      setContentStatus("Shorten the highlighted field before saving");
      return;
    }
    setContentStatus("Saving...");
    const response = await fetch("/api/admin/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        module: tab,
        fields: content.fields,
        sections: content.sections,
        removedFields: content.removedFields,
      }),
    });
    setContentStatus(
      response.ok
        ? "Saved"
        : (await response.json().catch(() => null))?.error || "Unable to save",
    );
  }

  if (!data)
    return (
      <form className="admin-auth" onSubmit={login}>
        <h1>Admin portal</h1>
        <div className="admin-auth-row">
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>
          <button className="btn btn-dark">Sign in</button>
        </div>
        {error && <p className="field-error">{error}</p>}
      </form>
    );

  const orders = data.orders as Order[];
  const enquiries = data.enquiries as Enquiry[];
  const pickupDates = Array.from(
    new Set(
      orders.flatMap(
        (order) => order.lines?.map((line) => line.pickupDate) || [],
      ),
    ),
  );

  return (
    <div className="admin-grid">
      <aside className="admin-nav">
        {adminTabs.map((item) => (
          <button
            key={item}
            className={tab === item ? "active" : ""}
            onClick={() => void selectTab(item)}
          >
            {item}
          </button>
        ))}
        <button
          className="btn btn-dark admin-signout"
          type="button"
          onClick={() => void logout()}
        >
          Sign out
        </button>
      </aside>
      <section>
        <div className="admin-section-heading">
          <div className="admin-section-title">
            <h1>{tab}</h1>
          </div>
          <div className="admin-section-actions">
            {tab === "products" && (
              <>
                <input id="product-modal-toggle" type="checkbox" hidden />
                <label
                  className="btn btn-dark admin-product-open"
                  htmlFor="product-modal-toggle"
                  onClick={startNewProduct}
                >
                  Add product
                </label>
              </>
            )}
            {tab === "pickup dates" && (
              <>
                <input id="pickup-modal-toggle" type="checkbox" hidden />
                <label
                  className="btn btn-dark admin-pickup-open"
                  htmlFor="pickup-modal-toggle"
                >
                  Add pickup date
                </label>
              </>
            )}
            {tab === "policy" && (
              <>
                <input id="policy-modal-toggle" type="checkbox" hidden />
                <label
                  className="btn btn-dark admin-policy-open"
                  htmlFor="policy-modal-toggle"
                >
                  Add policy section
                </label>
              </>
            )}
            <button
              className="admin-refresh"
              type="button"
              aria-label="Refresh admin data"
              title="Refresh"
              onClick={() => void load()}
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                <path d="M16 6.5A6.5 6.5 0 1 0 17 11" />
                <path d="M16 3.5v3h-3" />
              </svg>
            </button>
          </div>
        </div>
        {dashboardError && (
          <div className="notice">
            <strong>{dashboardError}</strong>
          </div>
        )}
        {tab === "orders" && (
          <table className="table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Items</th>
                <th>Payment</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {orders.length ? (
                orders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      {order.customer?.name}
                      <br />
                      <small>{order.customer?.email}</small>
                    </td>
                    <td>
                      {order.lines?.map((line, index) => (
                        <div key={index}>
                          {line.productName} · {line.variantLabel}{" "}
                          <span className="status">{line.status}</span>
                        </div>
                      ))}
                    </td>
                    <td>{order.paymentStatus}</td>
                    <td>{order.createdAt?.slice(0, 10)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4}>No orders yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        {tab === "pickup schedule" && (
          <div>
            {pickupDates.map((date) => (
              <div
                className="form-card"
                key={date}
                style={{ marginBottom: 14 }}
              >
                <h2>{date}</h2>
                {orders.flatMap((order) =>
                  (order.lines || [])
                    .filter((line) => line.pickupDate === date)
                    .map((line, index) => (
                      <p key={`${order.id}-${index}`}>
                        {order.customer?.name} · {line.productName} ·{" "}
                        {line.pickupWindow}
                      </p>
                    )),
                )}
                <button className="btn btn-dark" disabled>
                  Bulk ready email (configure Resend)
                </button>
              </div>
            ))}
          </div>
        )}
        {tab === "enquiries" && (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Request</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {enquiries.length ? (
                enquiries.map((enquiry) => (
                  <tr key={enquiry.id}>
                    <td>
                      {enquiry.name}
                      <br />
                      <small>
                        {enquiry.email}
                        <br />
                        {enquiry.phone}
                      </small>
                    </td>
                    <td>{enquiry.request}</td>
                    <td>
                      <span className="status">{enquiry.status}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3}>No enquiries yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        {tab === "products" && (
          <>
            <form className="admin-modal admin-product-form" onSubmit={addProduct}>
              <div className="admin-modal-header">
                <h2>{editingProductId ? "Edit product" : "Add product"}</h2>
                <label
                  className="btn btn-light admin-product-close"
                  htmlFor="product-modal-toggle"
                  aria-label="Close modal"
                  title="Close"
                >
                  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                    <path d="m5 5 10 10M15 5 5 15" />
                  </svg>
                </label>
              </div>
              <div className="admin-modal-body">
                <div className="admin-product-form-grid">
                <div className="field">
                  <label htmlFor="product-name">Product name</label>
                  <input
                    id="product-name"
                    value={newProduct.name}
                    onChange={(event) =>
                      setNewProduct({ ...newProduct, name: event.target.value })
                    }
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="product-price-6">Box of 6 price</label>
                  <input
                    id="product-price-6"
                    type="number"
                    min="0"
                    step="0.01"
                    value={newProduct.price6}
                    onChange={(event) =>
                      setNewProduct({
                        ...newProduct,
                        price6: event.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="product-price-12">Box of 12 price</label>
                  <input
                    id="product-price-12"
                    type="number"
                    min="0"
                    step="0.01"
                    value={newProduct.price12}
                    onChange={(event) =>
                      setNewProduct({
                        ...newProduct,
                        price12: event.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="product-description">Description</label>
                  <textarea
                    id="product-description"
                    rows={4}
                    value={newProduct.description}
                    onChange={(event) =>
                      setNewProduct({
                        ...newProduct,
                        description: event.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="product-ingredients">Order information</label>
                  <textarea
                    id="product-ingredients"
                    rows={4}
                    value={newProduct.ingredients}
                    onChange={(event) =>
                      setNewProduct({
                        ...newProduct,
                        ingredients: event.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="product-allergens">Allergens</label>
                  <textarea
                    id="product-allergens"
                    rows={4}
                    value={newProduct.allergens}
                    onChange={(event) =>
                      setNewProduct({
                        ...newProduct,
                        allergens: event.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="product-images">Product images</label>
                  <input
                    id="product-images"
                    name="images"
                    type="file"
                    accept="image/*"
                    multiple
                    required={!editingProductId}
                  />
                </div>
                </div>
              </div>
              <div className="admin-product-form-actions">
                <button className="btn btn-dark">{editingProductId ? "Save product" : "Publish product"}</button>
                {productStatus && <span>{productStatus}</span>}
              </div>
            </form>
            <div className="admin-record-grid">
              {managedProducts.map((product) => (
                <article className="admin-record" key={product.id}>
                  <div>
                    <h2>{product.name}</h2>
                    <p>{product.description}</p>
                  </div>
                  <div className="admin-record-meta">
                    <span>
                      {product.variants
                        .map((variant) => `${variant.label}: $${variant.price}`)
                        .join(" · ")}
                    </span>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => editProduct(product)}
                    >
                      Edit
                    </button>
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => void removeProduct(product.id)}
                    >
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
        {tab === "pickup dates" && (
          <>
            <form className="admin-modal admin-add-date" onSubmit={addPickupDate}>
              <div className="admin-modal-header">
                <h2>Add pickup date</h2>
                <label
                  className="btn btn-light admin-pickup-close"
                  htmlFor="pickup-modal-toggle"
                  aria-label="Close modal"
                  title="Close"
                >
                  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                    <path d="m5 5 10 10M15 5 5 15" />
                  </svg>
                </label>
              </div>
              <div className="admin-modal-body">
              <div className="field">
                <label htmlFor="new-pickup-date">Pickup date</label>
                <input
                  id="new-pickup-date"
                  type="date"
                  value={newPickupDate}
                  onChange={(event) => setNewPickupDate(event.target.value)}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="new-pickup-window">Pickup window</label>
                <input
                  id="new-pickup-window"
                  value={newPickupWindow}
                  maxLength={80}
                  onChange={(event) => setNewPickupWindow(event.target.value)}
                  required
                />
              </div>
              </div>
              <div className="admin-modal-actions">
                <button className="btn btn-dark">Add pickup date</button>
                {pickupDateStatus && <span>{pickupDateStatus}</span>}
              </div>
            </form>
            <div
              className="admin-filter-tabs"
              role="tablist"
              aria-label="Pickup date filters"
            >
              {(["all", "closed", "open"] as PickupFilter[]).map((filter) => (
                <button
                  key={filter}
                  className={pickupFilter === filter ? "active" : ""}
                  type="button"
                  role="tab"
                  aria-selected={pickupFilter === filter}
                  onClick={() => setPickupFilter(filter)}
                >
                  {filter === "all"
                    ? "All pickup windows"
                    : filter === "closed"
                      ? "Closed pickup windows"
                      : "Open pickup windows"}
                </button>
              ))}
            </div>
            <div className="admin-record-grid">
              {managedPickupDates
                .filter(
                  (pickupDate) =>
                    pickupFilter === "all" ||
                    (pickupFilter === "closed"
                      ? isDateClosed(pickupDate)
                      : !isDateClosed(pickupDate)),
                )
                .map((pickupDate) => {
                  const closed = isDateClosed(pickupDate);
                  return (
                    <article
                      className="admin-record admin-record-date"
                      key={pickupDate.id}
                    >
                      <div>
                        <h2>
                          {new Date(
                            `${pickupDate.date}T12:00:00`,
                          ).toLocaleDateString("en-AU", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                          })}
                        </h2>
                        <p>{pickupDate.window}</p>
                      </div>
                      <div className="admin-record-date-actions">
                        <span
                          className={closed ? "status" : "status status-live"}
                        >
                          {closed ? "Closed" : "Open"}
                        </span>
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => void removePickupDate(pickupDate.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  );
                })}
            </div>
          </>
        )}
        {tab === "email templates" && !emailTemplateKey && (
          <div className="admin-template-grid">
            {emailTemplates.map((template) => (
              <article className="admin-template-card" key={template.key}>
                <div>
                  <h2>{template.name}</h2>
                  <p>{template.description}</p>
                </div>
                <button className="btn btn-light" type="button" onClick={() => editEmailTemplate(template)}>
                  Edit template
                </button>
              </article>
            ))}
          </div>
        )}
        {tab === "email templates" && emailTemplateKey && (() => {
          const template = emailTemplates.find((item) => item.key === emailTemplateKey);
          if (!template) return null;
          return <form className="enquiry-form admin-editor" onSubmit={saveContent}>
            <div className="admin-template-editor-heading"><button className="text-button" type="button" onClick={() => setEmailTemplateKey(null)}>Back to templates</button><h2>{template.name}</h2><p>{template.description}</p></div>
            <div className="admin-editor-fields">
              <div className="field"><label htmlFor="email-template-subject">Subject <span>(140 characters max)</span></label><input id="email-template-subject" maxLength={140} value={content.fields[template.subjectField] || ""} onChange={(event) => setContent({ ...content, fields: { ...content.fields, [template.subjectField]: event.target.value } })} /><small className="admin-editor-count">{(content.fields[template.subjectField] || "").length} / 140</small></div>
              <div className="field"><label htmlFor="email-template-body">Body copy <span>(3000 characters max)</span></label><textarea id="email-template-body" rows={12} maxLength={3000} value={content.fields[template.bodyField] || ""} onChange={(event) => setContent({ ...content, fields: { ...content.fields, [template.bodyField]: event.target.value } })} /><small className="admin-editor-count">{(content.fields[template.bodyField] || "").length} / 3000</small></div>
            </div>
            <div className="admin-editor-actions"><button className="btn btn-light">Save template</button>{contentStatus && <span>{contentStatus}</span>}</div>
          </form>;
        })()}
        {contentModules[tab] && tab !== "email templates" && (
          <form className="enquiry-form admin-editor" onSubmit={saveContent}>
            <div className="admin-editor-fields">
              {contentModules[tab].fields
                .filter(
                  (field) =>
                    !(tab === "policy" &&
                    (content.removedFields || []).includes(field.key)),
                )
                .map((field) => {
                const value = content.fields[field.key] || "";
                const id = `content-${field.key}`;
                const optionalPolicyBody =
                  tab === "policy" &&
                  ["allergenCopy", "enquiryCopy"].includes(field.key);
                return (
                  <div className="field" key={field.key}>
                    <label htmlFor={id}>
                      {field.label}{" "}
                      <span>({field.maxLength} characters max)</span>
                    </label>
                    {field.multiline ? (
                      <textarea
                        id={id}
                        rows={5}
                        maxLength={field.maxLength}
                        value={value}
                        onChange={(event) =>
                          setContent({
                            ...content,
                            fields: {
                              ...content.fields,
                              [field.key]: event.target.value,
                            },
                          })
                        }
                      />
                    ) : (
                      <input
                        id={id}
                        maxLength={field.maxLength}
                        value={value}
                        onChange={(event) =>
                          setContent({
                            ...content,
                            fields: {
                              ...content.fields,
                              [field.key]: event.target.value,
                            },
                          })
                        }
                      />
                    )}
                    <small className="admin-editor-count">
                      {value.length} / {field.maxLength}
                    </small>
                    {optionalPolicyBody && (
                      <button
                        className="text-button"
                        type="button"
                        onClick={() =>
                          setContent({
                            ...content,
                            removedFields: [
                              ...(content.removedFields || []),
                              field.key,
                              field.key.replace("Copy", "Heading"),
                            ],
                          })
                        }
                      >
                        Remove section
                      </button>
                    )}
                  </div>
                );
                })}
              {tab === "policy" && (
                <div className="admin-modal admin-policy-sections">
                  <div className="admin-policy-sections-heading">
                    <div className="admin-modal-header">
                      <h2>Add policy section</h2>
                      <label
                        className="btn btn-light admin-policy-close"
                        htmlFor="policy-modal-toggle"
                        aria-label="Close modal"
                        title="Close"
                      >
                          <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                            <path d="m5 5 10 10M15 5 5 15" />
                          </svg>
                      </label>
                    </div>
                    <div className="admin-modal-body">
                    <p>
                      Add a heading and body copy for any extra policy section.
                    </p>
                  </div>
                  {(content.sections && content.sections.length
                    ? content.sections
                    : [{ heading: "", body: "" }]
                  ).map((section, index) => (
                    <div
                      className="admin-policy-section"
                      key={`policy-section-${index}`}
                    >
                      <div className="field">
                        <label htmlFor={`policy-section-heading-${index}`}>
                          Heading <span>(80 characters max)</span>
                        </label>
                        <input
                          id={`policy-section-heading-${index}`}
                          maxLength={80}
                          value={section.heading}
                          onChange={(event) =>
                            setContent({
                              ...content,
                              sections: (content.sections &&
                              content.sections.length
                                ? content.sections
                                : [{ heading: "", body: "" }]
                              ).map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, heading: event.target.value }
                                  : item,
                              ),
                            })
                          }
                        />
                        <small className="admin-editor-count">
                          {section.heading.length} / 80
                        </small>
                      </div>
                      <div className="field">
                        <label htmlFor={`policy-section-body-${index}`}>
                          Body copy <span>(1000 characters max)</span>
                        </label>
                        <textarea
                          id={`policy-section-body-${index}`}
                          rows={5}
                          maxLength={1000}
                          value={section.body}
                          onChange={(event) =>
                            setContent({
                              ...content,
                              sections: (content.sections &&
                              content.sections.length
                                ? content.sections
                                : [{ heading: "", body: "" }]
                              ).map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, body: event.target.value }
                                  : item,
                              ),
                            })
                          }
                        />
                        <small className="admin-editor-count">
                          {section.body.length} / 1000
                        </small>
                      </div>
                    </div>
                  ))}
                  <div className="admin-modal-actions">
                    <button
                      className="btn btn-dark"
                      type="button"
                      onClick={() =>
                        setContent({
                          ...content,
                          sections: [
                            ...(content.sections || []),
                            { heading: "", body: "" },
                          ],
                        })
                      }
                    >
                      Add another policy section
                    </button>
                  </div>
                  </div>
                </div>
              )}
            </div>
            <div className="admin-editor-actions">
              <button className="btn btn-light">Save changes</button>
              {contentStatus && <span>{contentStatus}</span>}
            </div>
          </form>
        )}
        {tab === "settings" && config && (
          <div className="admin-config-grid">
            {Object.entries(config).map(([name, ready]) => (
              <div className="admin-config-item" key={name}>
                <span>{name}</span>
                <strong className={ready ? "status status-live" : "status"}>
                  {ready ? "Configured" : "Missing"}
                </strong>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
