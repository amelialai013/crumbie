"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  defaultProductAllergens,
  defaultProductIngredients,
  isDateClosed,
  pickupDates as catalogPickupDates,
  productSlugFromName,
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
    pickupDateId?: string;
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
  openai: boolean;
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
      { key: "pageTitle", label: "Page heading", maxLength: 80 },
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
    defaults: {
      fields: {
        confirmationSubject: "Your Club Crumbie order is confirmed",
        confirmationBody: `Hi {{customerName}},

Thanks for your order with Club Crumbie. We have received your payment and your cookie box is confirmed.

Order number: {{orderNumber}}
Pickup date: {{pickupDate}}
Pickup window: {{pickupWindow}}
Order total: {{orderTotal}}

Pickup is in Ivanhoe, Victoria. We will include the exact address and any final collection details here.

Please keep this email for your records. We look forward to sharing your crumbs with you.

Club Crumbie`,
        pickupReminderSubject: "Your Club Crumbie pickup is coming up",
        pickupReminderBody: `Hi {{customerName}},

Just a reminder that your Club Crumbie order is ready for pickup soon.

Pickup date: {{pickupDate}}
Pickup window: {{pickupWindow}}
Order number: {{orderNumber}}

Pickup is in Ivanhoe, Victoria. We will include the exact address and any collection instructions here.

Please arrive during your pickup window so we can hand over your box while it is fresh.

See you soon,
Club Crumbie`,
        enquirySubject: "New Club Crumbie enquiry from {{customerName}}",
        enquiryBody: `A new enquiry has been submitted through the Club Crumbie Contact Us form.

Name: {{customerName}}
Email: {{customerEmail}}
Phone: {{customerPhone}}

Message:
{{customerMessage}}

Please reply to the customer directly when you are ready to follow up.

Club Crumbie`,
      },
    },
  },
  settings: {
    fields: [
      { key: "pickupAddress", label: "Pickup address", maxLength: 240 },
      { key: "notificationEmail", label: "Email address", maxLength: 200 },
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

function formatPickupDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-AU", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function getFirstSaturdayOfNextMonth() {
  const date = new Date();
  const firstOfNextMonth = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    1,
  );
  const daysUntilSaturday = (6 - firstOfNextMonth.getDay() + 7) % 7;
  firstOfNextMonth.setDate(firstOfNextMonth.getDate() + daysUntilSaturday);

  return [
    firstOfNextMonth.getFullYear(),
    String(firstOfNextMonth.getMonth() + 1).padStart(2, "0"),
    String(firstOfNextMonth.getDate()).padStart(2, "0"),
  ].join("-");
}

export default function AdminDashboard() {
  const [password, setPassword] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("orders");
  const [content, setContent] = useState<Content>({ fields: {} });
  const [contentStatus, setContentStatus] = useState("");
  const [config, setConfig] = useState<Config | null>(null);
  const [dashboardError, setDashboardError] = useState("");
  const [managedPickupDates, setManagedPickupDates] =
    useState<PickupDate[]>(catalogPickupDates);
  const [newPickupDate, setNewPickupDate] = useState(
    getFirstSaturdayOfNextMonth,
  );
  const [newPickupWindow, setNewPickupWindow] = useState("10:00am–12:00pm");
  const [pickupDateStatus, setPickupDateStatus] = useState("");
  const [adminNotice, setAdminNotice] = useState("");
  const [pickupDatePendingRemoval, setPickupDatePendingRemoval] =
    useState<PickupDate | null>(null);
  const [blockedPickupDateRemoval, setBlockedPickupDateRemoval] = useState<{
    pickupDate: PickupDate;
    orderCount: number;
  } | null>(null);
  const [removingPickupDateId, setRemovingPickupDateId] = useState("");
  const [pickupFilter, setPickupFilter] = useState<PickupFilter>("all");
  const [managedProducts, setManagedProducts] = useState<Product[]>(products);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [productStatus, setProductStatus] = useState("");
  const [newProduct, setNewProduct] = useState({
    name: "",
    description: "",
    ingredients: defaultProductIngredients,
    allergens: defaultProductAllergens,
    price6: "",
    price12: "",
  });
  const [productImages, setProductImages] = useState<string[]>([]);
  const [referenceImageFiles, setReferenceImageFiles] = useState<File[]>([]);
  const [referenceDropActive, setReferenceDropActive] = useState(false);
  const [imageDirection, setImageDirection] = useState("");
  const [generatedImageCount, setGeneratedImageCount] = useState(5);
  const [generationStatus, setGenerationStatus] = useState("");
  const [descriptionStatus, setDescriptionStatus] = useState("");
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
    async function loadAdminResources() {
      const [
        dashboardResult,
        configResult,
        pickupDatesResult,
        productsResult,
      ] = await Promise.allSettled([
        fetch("/api/admin/dashboard"),
        fetch("/api/admin/config"),
        fetch("/api/admin/pickup-dates"),
        fetch("/api/admin/products"),
      ]);

      if (
        dashboardResult.status === "fulfilled" &&
        dashboardResult.value.ok
      ) {
        setData(await dashboardResult.value.json());
      }
      if (configResult.status === "fulfilled" && configResult.value.ok) {
        setConfig(await configResult.value.json());
      }
      if (
        pickupDatesResult.status === "fulfilled" &&
        pickupDatesResult.value.ok
      ) {
        setManagedPickupDates(await pickupDatesResult.value.json());
      }
      if (productsResult.status === "fulfilled" && productsResult.value.ok) {
        setManagedProducts(await productsResult.value.json());
      }
      setProductsLoaded(true);
    }

    void loadAdminResources();
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [tab]);

  useEffect(() => {
    if (!menuOpen) return;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!adminNotice) return;
    const timeout = window.setTimeout(() => setAdminNotice(""), 3600);
    return () => window.clearTimeout(timeout);
  }, [adminNotice]);

  useEffect(() => {
    if (!pickupDatePendingRemoval && !blockedPickupDateRemoval) return;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setPickupDatePendingRemoval(null);
        setBlockedPickupDateRemoval(null);
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [blockedPickupDateRemoval, pickupDatePendingRemoval]);

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
    setNewPickupDate(getFirstSaturdayOfNextMonth());
    setPickupDateStatus("");
    setAdminNotice("Pickup date successfully added");
    const pickupModalToggle = document.getElementById("pickup-modal-toggle");
    if (pickupModalToggle instanceof HTMLInputElement) {
      pickupModalToggle.checked = false;
    }
  }

  async function removePickupDate() {
    if (!pickupDatePendingRemoval) return;
    const { id } = pickupDatePendingRemoval;
    setRemovingPickupDateId(id);
    setPickupDateStatus("Removing...");
    const response = await fetch(
      `/api/admin/pickup-dates?id=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      setRemovingPickupDateId("");
      setPickupDateStatus(
        (await response.json().catch(() => null))?.error ||
          "Unable to remove pickup date",
      );
      return;
    }
    setManagedPickupDates((current) =>
      current.filter((date) => date.id !== id),
    );
    setRemovingPickupDateId("");
    setPickupDatePendingRemoval(null);
    setPickupDateStatus("");
    setAdminNotice("Pickup date successfully removed");
  }

  function orderCountForPickupDate(pickupDate: PickupDate) {
    const orders = (data?.orders || []) as Order[];
    return orders.filter((order) =>
      order.lines?.some(
        (line) =>
          line.pickupDateId === pickupDate.id ||
          line.pickupDate === pickupDate.date,
      ),
    ).length;
  }

  function requestPickupDateRemoval(pickupDate: PickupDate) {
    const orderCount = orderCountForPickupDate(pickupDate);
    if (orderCount > 0) {
      setBlockedPickupDateRemoval({ pickupDate, orderCount });
      return;
    }
    setPickupDatePendingRemoval(pickupDate);
  }

  async function addProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const wasEditing = Boolean(editingProductId);
    setProductStatus(wasEditing ? "Saving..." : "Publishing...");
    const form = event.currentTarget;
    const formData = new FormData(form);
    const slug = productSlugFromName(newProduct.name);
    const product = {
      id: editingProductId || `product-${slug}`,
      slug,
      name: newProduct.name.trim(),
      description: newProduct.description.trim(),
      ingredients: newProduct.ingredients.trim() || defaultProductIngredients,
      allergens: newProduct.allergens.trim() || defaultProductAllergens,
      images: productImages,
      imageMode: productImages.length > 0 ? "gallery" : undefined,
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
      ingredients: defaultProductIngredients,
      allergens: defaultProductAllergens,
      price6: "",
      price12: "",
    });
    setEditingProductId(null);
    setProductImages([]);
    form.reset();
    setProductStatus("");
    setAdminNotice(wasEditing ? "Product successfully saved" : "Product successfully published");
    const productModalToggle = document.getElementById("product-modal-toggle");
    if (productModalToggle instanceof HTMLInputElement) {
      productModalToggle.checked = false;
    }
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
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
    setProductImages(product.images);
    setReferenceImageFiles([]);
    setImageDirection("");
    setGenerationStatus("");
    (document.getElementById("product-modal-toggle") as HTMLInputElement).checked = true;
  }

  function startNewProduct() {
    setEditingProductId(null);
    setNewProduct({ name: "", description: "", ingredients: defaultProductIngredients, allergens: defaultProductAllergens, price6: "", price12: "" });
    setProductImages([]);
    setReferenceImageFiles([]);
    setImageDirection("");
    setGenerationStatus("");
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
    setProductStatus("");
    setAdminNotice("Product successfully removed");
  }

  function adjustProductPrice(field: "price6" | "price12", amount: number) {
    const current = Number(newProduct[field]) || 0;
    setNewProduct({
      ...newProduct,
      [field]: String(Math.max(0, current + amount)),
    });
  }

  function removeProductImage(index: number) {
    setProductImages((current) =>
      current.filter((_, currentIndex) => currentIndex !== index),
    );
  }

  function setReferenceImages(files: File[]) {
    const images = files.filter((file) => file.type.startsWith("image/"));
    const selected = images.slice(0, 5);
    setReferenceImageFiles(selected);
    if (files.length > 5) {
      setGenerationStatus("Use up to five reference photos.");
    } else if (files.length !== images.length) {
      setGenerationStatus("Only image files can be used as reference photos.");
    } else {
      setGenerationStatus("");
    }
  }

  function removeReferenceImage(index: number) {
    setReferenceImageFiles((current) =>
      current.filter((_, currentIndex) => currentIndex !== index),
    );
    setGenerationStatus("");
  }

  async function generateProductImage() {
    if (!newProduct.name.trim()) {
      setGenerationStatus("Enter a product name before generating.");
      return;
    }
    if (!referenceImageFiles.length) {
      setGenerationStatus("Add at least one reference photo before generating.");
      return;
    }

    setGenerationStatus("Generating images with OpenAI...");
    const formData = new FormData();
    formData.set("name", newProduct.name.trim());
    formData.set("direction", imageDirection.trim());
    formData.set("count", String(generatedImageCount));
    referenceImageFiles.forEach((file) => formData.append("references", file));
    const response = await fetch("/api/admin/product-images/generate", {
      method: "POST",
      body: formData,
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(result?.images)) {
      setGenerationStatus(result?.error || "Unable to generate an image.");
      return;
    }
    setProductImages(result.images);
    setGenerationStatus(
      `${result.images.length} transparent PNGs generated. The side profile is the storefront cover; the remaining images rotate on the product page.`,
    );
  }

  async function generateProductDescription() {
    if (!newProduct.name.trim()) {
      setDescriptionStatus("Enter a product name before generating.");
      return;
    }

    setDescriptionStatus("Generating description with OpenAI...");
    const response = await fetch("/api/admin/products/generate-description", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newProduct.name.trim() }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.description) {
      setDescriptionStatus(result?.error || "Unable to generate a description.");
      return;
    }
    setNewProduct({ ...newProduct, description: result.description });
    setDescriptionStatus("Description generated. Feel free to edit it before saving.");
  }

  const optionalPolicySections = [
    { number: 5, headingKey: "allergenHeading", bodyKey: "allergenCopy" },
    { number: 6, headingKey: "enquiryHeading", bodyKey: "enquiryCopy" },
  ] as const;

  function renderContentField(field: ContentField) {
    const value = content.fields[field.key] || "";
    const id = `content-${field.key}`;

    return (
      <div className="field" key={field.key}>
        <label htmlFor={id}>
          {field.label} <span>({field.maxLength} characters max)</span>
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
                fields: { ...content.fields, [field.key]: event.target.value },
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
                fields: { ...content.fields, [field.key]: event.target.value },
              })
            }
          />
        )}
        <small className="admin-editor-count">
          {value.length} / {field.maxLength}
        </small>
      </div>
    );
  }

  async function selectTab(nextTab: string) {
    setTab(nextTab);
    setMenuOpen(false);
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
    if (response.ok) {
      setContentStatus("");
      setAdminNotice(tab === "email templates" ? "Template successfully saved" : "Changes successfully saved");
      return;
    }
    setContentStatus(
      (await response.json().catch(() => null))?.error || "Unable to save",
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
      <button
        className="admin-menu-toggle"
        type="button"
        aria-expanded={menuOpen}
        aria-controls="admin-navigation"
        onClick={() => setMenuOpen((isOpen) => !isOpen)}
      >
        <span className="admin-menu-toggle-copy">
          <span>Section</span>
        </span>
        <span className="admin-menu-toggle-icon" aria-hidden="true">
          +
        </span>
      </button>
      <button
        className={`admin-nav-backdrop${menuOpen ? " is-open" : ""}`}
        type="button"
        aria-label="Close sections menu"
        tabIndex={menuOpen ? 0 : -1}
        onClick={() => setMenuOpen(false)}
      />
      <aside
        id="admin-navigation"
        className={`admin-nav${menuOpen ? " is-open" : ""}`}
        aria-label="Admin sections"
      >
        <button
          className="admin-menu-close"
          type="button"
          aria-label="Close sections menu"
          onClick={() => setMenuOpen(false)}
        >
          <span aria-hidden="true">×</span>
        </button>
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
        {adminNotice && (
          <div className="admin-toast" role="status" aria-live="polite">
            <span>{adminNotice}</span>
            <button
              aria-label="Dismiss notification"
              type="button"
              onClick={() => setAdminNotice("")}
            >
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                <path d="m5 5 10 10M15 5 5 15" />
              </svg>
            </button>
          </div>
        )}
        {pickupDatePendingRemoval && (
          <div
            className="admin-confirm-overlay"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget)
                setPickupDatePendingRemoval(null);
            }}
          >
            <div
              aria-labelledby="pickup-remove-title"
              aria-describedby="pickup-remove-copy"
              aria-modal="true"
              className="admin-confirm-modal"
              role="dialog"
            >
              <h2 id="pickup-remove-title">Remove this pickup date?</h2>
              <p id="pickup-remove-copy">
                This will remove{" "}
                <strong>
                  {formatPickupDate(pickupDatePendingRemoval.date)}
                </strong>{" "}
                from the checkout calendar. Customers will not be able to choose
                this pickup window once it is removed.
              </p>
              <div className="admin-confirm-actions">
                <button
                  className="btn btn-light"
                  type="button"
                  onClick={() => setPickupDatePendingRemoval(null)}
                  disabled={Boolean(removingPickupDateId)}
                >
                  Keep date
                </button>
                <button
                  className="btn btn-dark admin-confirm-danger"
                  type="button"
                  onClick={() => void removePickupDate()}
                  disabled={Boolean(removingPickupDateId)}
                >
                  {removingPickupDateId ? "Removing..." : "Yes, remove it"}
                </button>
              </div>
            </div>
          </div>
        )}
        {blockedPickupDateRemoval && (
          <div
            className="admin-confirm-overlay"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget)
                setBlockedPickupDateRemoval(null);
            }}
          >
            <div
              aria-labelledby="pickup-blocked-title"
              aria-describedby="pickup-blocked-copy"
              aria-modal="true"
              className="admin-confirm-modal"
              role="dialog"
            >
              <h2 id="pickup-blocked-title">This pickup date has orders</h2>
              <p id="pickup-blocked-copy">
                You cannot remove{" "}
                <strong>
                  {formatPickupDate(blockedPickupDateRemoval.pickupDate.date)}
                </strong>{" "}
                until you move all orders that have chosen this date to a
                different pickup date.
              </p>
              <p>
                {blockedPickupDateRemoval.orderCount}{" "}
                {blockedPickupDateRemoval.orderCount === 1
                  ? "order is"
                  : "orders are"}{" "}
                currently using this pickup date.
              </p>
              <div className="admin-confirm-actions">
                <button
                  className="btn btn-light"
                  type="button"
                  onClick={() => setBlockedPickupDateRemoval(null)}
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        )}
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
                  <td colSpan={4}>No orders yet</td>
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
                  <td colSpan={3}>No enquiries yet</td>
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
                  <div className="quantity-stepper admin-number-stepper">
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
                    <div className="quantity-stepper-controls">
                      <button
                        type="button"
                        onClick={() => adjustProductPrice("price6", -1)}
                        disabled={Number(newProduct.price6) <= 0}
                        aria-label="Decrease box of 6 price"
                      >
                        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
                          <path d="M3 8h10" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustProductPrice("price6", 1)}
                        aria-label="Increase box of 6 price"
                      >
                        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
                          <path d="M8 3v10M3 8h10" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                <div className="field">
                  <label htmlFor="product-price-12">Box of 12 price</label>
                  <div className="quantity-stepper admin-number-stepper">
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
                    <div className="quantity-stepper-controls">
                      <button
                        type="button"
                        onClick={() => adjustProductPrice("price12", -1)}
                        disabled={Number(newProduct.price12) <= 0}
                        aria-label="Decrease box of 12 price"
                      >
                        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
                          <path d="M3 8h10" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustProductPrice("price12", 1)}
                        aria-label="Increase box of 12 price"
                      >
                        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
                          <path d="M8 3v10M3 8h10" />
                        </svg>
                      </button>
                    </div>
                  </div>
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
                  <button
                    type="button"
                    className="btn btn-light"
                    onClick={generateProductDescription}
                    disabled={descriptionStatus.startsWith("Generating")}
                  >
                    {descriptionStatus.startsWith("Generating")
                      ? "Generating..."
                      : "Generate description with OpenAI"}
                  </button>
                  {descriptionStatus && !descriptionStatus.startsWith("Generating") && (
                    <p className="admin-generator-status">{descriptionStatus}</p>
                  )}
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
                <fieldset className="admin-image-generator">
                  <legend>Product imagery</legend>
                  <p>
                    Add up to five reference photos and generate the complete
                    storefront image set. OpenAI automatically creates a
                    side-profile image, like the Signature Crumbie, as the
                    storefront cover; the remaining images become the
                    rotatable product-page view. Generating a new set replaces
                    the current product imagery.
                  </p>
                  <label
                    className={`admin-reference-dropzone${referenceDropActive ? " is-active" : ""}`}
                    htmlFor="product-image-references"
                    tabIndex={0}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      setReferenceDropActive(true);
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDragLeave={(event) => {
                      if (event.currentTarget === event.target) {
                        setReferenceDropActive(false);
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      setReferenceDropActive(false);
                      setReferenceImages(Array.from(event.dataTransfer.files));
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        document.getElementById("product-image-references")?.click();
                      }
                    }}
                  >
                    <span>Drop reference photos here</span>
                    <small>or browse files · up to 5 images · 10MB each</small>
                    <input
                      id="product-image-references"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) =>
                        setReferenceImages(Array.from(event.target.files ?? []))
                      }
                    />
                  </label>
                  {referenceImageFiles.length > 0 && (
                    <ul className="admin-reference-selection" aria-label="Selected reference photos">
                      {referenceImageFiles.map((file, index) => (
                        <li key={`${file.name}-${file.lastModified}`}>
                          <span>{file.name}</span>
                          <button
                            className="text-button"
                            type="button"
                            onClick={() => removeReferenceImage(index)}
                            aria-label={`Remove ${file.name}`}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <label htmlFor="product-image-count">Images to generate</label>
                  <select
                    id="product-image-count"
                    value={generatedImageCount}
                    onChange={(event) => setGeneratedImageCount(Number(event.target.value))}
                  >
                    <option value={1}>1 image</option>
                    <option value={2}>2 images</option>
                    <option value={3}>3 images</option>
                    <option value={4}>4 images</option>
                    <option value={5}>5 images (recommended)</option>
                  </select>
                  <label htmlFor="product-image-direction">
                    Additional creative direction <span>(optional)</span>
                  </label>
                  <textarea
                    id="product-image-direction"
                    rows={3}
                    maxLength={500}
                    value={imageDirection}
                    onChange={(event) => setImageDirection(event.target.value)}
                    placeholder="For example: show a broken edge and generous chocolate chunks."
                  />
                  <button
                    className="btn btn-outline"
                    type="button"
                    disabled={generationStatus.startsWith("Generating")}
                    onClick={generateProductImage}
                  >
                    {generationStatus.startsWith("Generating")
                      ? "Generating..."
                      : `Generate ${generatedImageCount} image${generatedImageCount === 1 ? "" : "s"} with OpenAI`}
                  </button>
                  {generationStatus && (
                    <p className="admin-generator-status" role="status">
                      {generationStatus}
                    </p>
                  )}
                  {productImages.length > 0 && (
                    <ol className="admin-product-images">
                      {productImages.map((image, index) => (
                        <li key={image}>
                          <Image
                            src={image}
                            alt=""
                            width={56}
                            height={44}
                            unoptimized={!image.includes("images.unsplash.com")}
                          />
                          <div>
                            <strong>{index === 0 ? "Automatic storefront cover" : `Rotation frame ${index}`}</strong>
                            <span>{image.split("/").pop()}</span>
                          </div>
                          <div className="admin-product-image-actions">
                            <button
                              className="text-button"
                              type="button"
                              onClick={() => removeProductImage(index)}
                            >
                              Remove
                            </button>
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </fieldset>
                </div>
              </div>
              <div className="admin-product-form-actions">
                <button className="btn btn-dark">{editingProductId ? "Save product" : "Publish product"}</button>
                {productStatus && <span>{productStatus}</span>}
              </div>
            </form>
            {!productsLoaded ? (
              <p className="admin-products-loading" role="status">
                Loading products...
              </p>
            ) : (
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
            )}
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
                          {formatPickupDate(pickupDate.date)}
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
                          onClick={() => requestPickupDateRemoval(pickupDate)}
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
            <div className="admin-template-editor-heading"><button className="text-button" type="button" onClick={() => setEmailTemplateKey(null)}><svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="m10 3-5 5 5 5" /></svg>Back to templates</button><h2>{template.name}</h2><p>{template.description}</p></div>
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
                    (content.removedFields || []).includes(field.key)) &&
                    !(tab === "policy" &&
                    optionalPolicySections.some(
                      (section) =>
                        field.key === section.headingKey ||
                        field.key === section.bodyKey,
                    )),
                )
                .map(renderContentField)}
              {tab === "policy" &&
                optionalPolicySections
                  .filter(
                    (section) =>
                      !(content.removedFields || []).includes(section.headingKey) &&
                      !(content.removedFields || []).includes(section.bodyKey),
                  )
                  .map((section) => {
                    const headingField = contentModules.policy.fields.find(
                      (field) => field.key === section.headingKey,
                    );
                    const bodyField = contentModules.policy.fields.find(
                      (field) => field.key === section.bodyKey,
                    );
                    if (!headingField || !bodyField) return null;
                    return (
                      <section
                        className="admin-policy-editor-section"
                        key={`policy-section-${section.number}`}
                      >
                        <div className="admin-policy-editor-section-heading">
                          <h3>Section {section.number}</h3>
                          <button
                            className="text-button"
                            type="button"
                            onClick={() =>
                              setContent({
                                ...content,
                                removedFields: [
                                  ...(content.removedFields || []),
                                  section.headingKey,
                                  section.bodyKey,
                                ],
                              })
                            }
                          >
                            Remove section
                          </button>
                        </div>
                        {renderContentField(headingField)}
                        {renderContentField(bodyField)}
                      </section>
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
                    </div>
                  {(content.sections && content.sections.length
                    ? content.sections
                    : [{ heading: "", body: "" }]
                  ).map((section, index) => (
                    <div
                      className="admin-policy-section"
                      key={`policy-section-${index}`}
                    >
                      <h3>Section {index + 7}</h3>
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
