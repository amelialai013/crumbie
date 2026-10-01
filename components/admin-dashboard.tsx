"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { TimePicker } from "./time-picker";
import { DatePicker } from "./date-picker";
import PremiumSelect from "./premium-select";
import { formatPickupDate } from "@/lib/format-date";
import { policyBodyMaxChars } from "@/lib/text-limits";
import { defaultEnquiryTypes, enquiryTypeMaxLength, pickupAddressToken, withEnquiryType, withPickupAddress } from "@/lib/email-templates";

const usesPickupAddress = (field: string) => field === "confirmationBody" || field === "pickupReminderBody";
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
const configLabels: Record<keyof Config, string> = {
  store: "Store",
  stripe: "Stripe",
  resend: "Resend",
  openai: "OpenAI",
  r2: "R2",
  session: "Session",
};
type ContentField = {
  key: string;
  label: string;
  maxLength: number;
  body?: boolean;
  multiline?: boolean;
  rows?: number;
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
      { key: "howTitle", label: "Secondary heading", maxLength: 80 },
      { key: "stepOneTitle", label: "Step 1 heading", maxLength: 60 },
      {
        key: "stepOneBody",
        label: "Step 1 body copy",
        maxLength: 80,
        multiline: true,
        rows: 1,
      },
      { key: "stepTwoTitle", label: "Step 2 heading", maxLength: 60 },
      {
        key: "stepTwoBody",
        label: "Step 2 body copy",
        maxLength: 80,
        multiline: true,
        rows: 1,
      },
      { key: "stepThreeTitle", label: "Step 3 heading", maxLength: 60 },
      {
        key: "stepThreeBody",
        label: "Step 3 body copy",
        maxLength: 80,
        multiline: true,
        rows: 1,
      },
      {
        key: "catalogHeading",
        label: "Product section heading",
        maxLength: 80,
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
      { key: "storyHeading", label: "Heading 1", maxLength: 80 },
      {
        key: "storyCopy",
        label: "Body copy 1",
        maxLength: 1200,
        multiline: true,
      },
      { key: "batchHeading", label: "Heading 2", maxLength: 80 },
      { key: "batchCopy", label: "Body copy 2", maxLength: 800, multiline: true },
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
        maxLength: policyBodyMaxChars,
        body: true,
        multiline: true,
      },
      { key: "deadlineHeading", label: "Section 2 heading", maxLength: 80 },
      {
        key: "deadlineCopy",
        label: "Section 2 body copy",
        maxLength: policyBodyMaxChars,
        body: true,
        multiline: true,
      },
      { key: "paymentHeading", label: "Section 3 heading", maxLength: 80 },
      {
        key: "paymentCopy",
        label: "Section 3 body copy",
        maxLength: policyBodyMaxChars,
        body: true,
        multiline: true,
      },
      { key: "cancellationHeading", label: "Section 4 heading", maxLength: 80 },
      {
        key: "cancellationCopy",
        label: "Section 4 body copy",
        maxLength: policyBodyMaxChars,
        body: true,
        multiline: true,
      },
      { key: "allergenHeading", label: "Section 5 heading", maxLength: 80 },
      {
        key: "allergenCopy",
        label: "Section 5 body copy",
        maxLength: policyBodyMaxChars,
        body: true,
        multiline: true,
      },
      { key: "enquiryHeading", label: "Section 6 heading", maxLength: 80 },
      {
        key: "enquiryCopy",
        label: "Section 6 body copy",
        maxLength: policyBodyMaxChars,
        body: true,
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
        enquiryTypes: defaultEnquiryTypes.join("\n"),
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
Pickup address: {{pickupAddress}}

Please keep this email for your records. We look forward to sharing your crumbs with you.

Club Crumbie`,
        pickupReminderSubject: "Your Club Crumbie pickup is coming up",
        pickupReminderBody: `Hi {{customerName}},

Just a reminder that your Club Crumbie order is ready for pickup soon.

Pickup date: {{pickupDate}}
Pickup window: {{pickupWindow}}
Order number: {{orderNumber}}
Pickup address: {{pickupAddress}}

Please arrive during your pickup window so we can hand over your box while it is fresh.

See you soon,
Club Crumbie`,
        enquirySubject: "New Club Crumbie enquiry from {{customerName}}",
        enquiryBody: `A new enquiry has been submitted through the Club Crumbie Contact Us form.

Name: {{customerName}}
Email: {{customerEmail}}
Phone: {{customerPhone}}
Enquiry type: {{enquiryType}}

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


const DEFAULT_PICKUP_START = "10:00";
const DEFAULT_PICKUP_END = "12:00";
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function formatPickupTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const period = hours >= 12 ? "pm" : "am";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, "0")}${period}`;
}

function firstSaturdayOfNextMonth() {
  const now = new Date();
  const firstOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const dayOffset = (6 - firstOfNextMonth.getDay() + 7) % 7;
  firstOfNextMonth.setDate(firstOfNextMonth.getDate() + dayOffset);
  const year = firstOfNextMonth.getFullYear();
  const month = String(firstOfNextMonth.getMonth() + 1).padStart(2, "0");
  const day = String(firstOfNextMonth.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function AdminDashboard() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [tab, setTab] = useState("orders");
  const [content, setContent] = useState<Content>({ fields: {} });
  const [savedContent, setSavedContent] = useState(() => JSON.stringify({ fields: {} }));
  const [draggedEnquiryType, setDraggedEnquiryType] = useState<number | null>(null);
  const [contentStatus, setContentStatus] = useState("");
  const [config, setConfig] = useState<Config | null>(null);
  const [dashboardError, setDashboardError] = useState("");
  const [managedPickupDates, setManagedPickupDates] =
    useState<PickupDate[]>(catalogPickupDates);
  const [newPickupDate, setNewPickupDate] = useState(() =>
    firstSaturdayOfNextMonth(),
  );
  const [newPickupStart, setNewPickupStart] = useState(DEFAULT_PICKUP_START);
  const [newPickupEnd, setNewPickupEnd] = useState(DEFAULT_PICKUP_END);
  const [pickupFormKey, setPickupFormKey] = useState(0);
  const [pickupDateStatus, setPickupDateStatus] = useState("");
  const [pickupFieldErrors, setPickupFieldErrors] = useState<
    Record<string, string>
  >({});
  const [adminNotice, setAdminNotice] = useState("");
  const [adminNoticeLeaving, setAdminNoticeLeaving] = useState(false);
  const [adminBusyMessage, setAdminBusyMessage] = useState("");
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
  const [productFieldErrors, setProductFieldErrors] = useState<
    Record<string, string>
  >({});
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
  const [generatedImageCount, setGeneratedImageCount] = useState(9);
  const [generationStatus, setGenerationStatus] = useState("");
  const [descriptionStatus, setDescriptionStatus] = useState("");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [emailTemplateKey, setEmailTemplateKey] = useState<string | null>(null);
  const [savedProduct, setSavedProduct] = useState<string | null>(null);
  const contentChanged = JSON.stringify(content) !== savedContent;
  const productChanged =
    !editingProductId || JSON.stringify({ newProduct, productImages }) !== savedProduct;

  function loadContent(next: Content) {
    setContent(next);
    setSavedContent(JSON.stringify(next));
  }

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
      setCheckingSession(false);
    }

    void loadAdminResources();
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [tab]);

  const signedIn = data !== null;
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [signedIn]);

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
    const timeout = window.setTimeout(() => dismissAdminNotice(), 3600);
    return () => window.clearTimeout(timeout);
  }, [adminNotice]);

  function dismissAdminNotice() {
    setAdminNoticeLeaving(true);
    window.setTimeout(() => {
      setAdminNotice("");
      setAdminNoticeLeaving(false);
    }, 320);
  }

  function beginAdminAction(busyMessage: string) {
    setAdminNotice("");
    setAdminNoticeLeaving(false);
    setAdminBusyMessage(busyMessage);
  }

  function finishAdminAction(successMessage?: string) {
    setAdminBusyMessage("");
    if (!successMessage) return;
    setAdminNoticeLeaving(false);
    setAdminNotice(successMessage);
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  }

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
    if (!password.trim()) {
      setError("Enter your password.");
      return;
    }
    setError("");
    setSigningIn(true);
    try {
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
    } catch {
      setError("Couldn't sign in. Check your connection and try again.");
    } finally {
      setSigningIn(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setTab("orders");
    setData(null);
    setConfig(null);
    setError("");
  }

  function resetPickupForm() {
    setNewPickupDate(firstSaturdayOfNextMonth());
    setNewPickupStart(DEFAULT_PICKUP_START);
    setNewPickupEnd(DEFAULT_PICKUP_END);
    setPickupDateStatus("");
    setPickupFieldErrors({});
    setPickupFormKey((key) => key + 1);
  }

  async function addPickupDate(event: React.FormEvent) {
    event.preventDefault();
    const fieldErrors: Record<string, string> = {};
    if (!newPickupDate.trim()) fieldErrors.date = "Choose a pickup date.";
    if (!TIME_PATTERN.test(newPickupStart))
      fieldErrors.start = "Enter a valid start time.";
    if (!TIME_PATTERN.test(newPickupEnd))
      fieldErrors.end = "Enter a valid end time.";
    else if (!fieldErrors.start && newPickupEnd <= newPickupStart)
      fieldErrors.end = "End time must be after the start time.";
    setPickupFieldErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;
    setPickupDateStatus("Saving...");
    beginAdminAction("Adding pickup date…");
    const response = await fetch("/api/admin/pickup-dates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: newPickupDate,
        window: `${formatPickupTime(newPickupStart)}–${formatPickupTime(newPickupEnd)}`,
      }),
    });
    if (!response.ok) {
      finishAdminAction();
      const message =
        (await response.json().catch(() => null))?.error ||
        "Unable to save pickup date";
      setPickupDateStatus("");
      setPickupFieldErrors({ date: message });
      return;
    }
    const savedDate = await response.json();
    setManagedPickupDates((current) =>
      [...current.filter((date) => date.id !== savedDate.id), savedDate].sort(
        (left, right) => left.date.localeCompare(right.date),
      ),
    );
    resetPickupForm();
    finishAdminAction("Pickup date successfully added");
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
    beginAdminAction("Removing pickup date…");
    const response = await fetch(
      `/api/admin/pickup-dates?id=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      setRemovingPickupDateId("");
      finishAdminAction();
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
    finishAdminAction("Pickup date successfully removed");
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
    const fieldErrors: Record<string, string> = {};
    if (!newProduct.name.trim()) fieldErrors.name = "Enter a product name.";
    if (!newProduct.description.trim())
      fieldErrors.description = "Enter a description.";
    if (!newProduct.ingredients.trim())
      fieldErrors.ingredients = "Enter order information.";
    if (!newProduct.allergens.trim())
      fieldErrors.allergens = "Enter allergen information.";
    if (!newProduct.price6.trim())
      fieldErrors.price6 = "Enter a box of 6 price.";
    if (!newProduct.price12.trim())
      fieldErrors.price12 = "Enter a box of 12 price.";
    setProductFieldErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;
    const wasEditing = Boolean(editingProductId);
    setProductStatus(wasEditing ? "Saving..." : "Publishing...");
    beginAdminAction(wasEditing ? "Saving product…" : "Publishing product…");
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
      finishAdminAction();
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
    setProductFieldErrors({});
    finishAdminAction(wasEditing ? "Product successfully saved" : "Product successfully published");
    const productModalToggle = document.getElementById("product-modal-toggle");
    if (productModalToggle instanceof HTMLInputElement) {
      productModalToggle.checked = false;
    }
  }

  function editProduct(product: Product) {
    const productForm = {
      name: product.name,
      description: product.description,
      ingredients: product.ingredients,
      allergens: product.allergens,
      price6: String(product.variants.find((variant) => variant.quantity === 6)?.price || ""),
      price12: String(product.variants.find((variant) => variant.quantity === 12)?.price || ""),
    };
    setEditingProductId(product.id);
    setProductFieldErrors({});
    setNewProduct(productForm);
    setProductImages(product.images);
    setSavedProduct(JSON.stringify({ newProduct: productForm, productImages: product.images }));
    setReferenceImageFiles([]);
    setImageDirection("");
    setGenerationStatus("");
    (document.getElementById("product-modal-toggle") as HTMLInputElement).checked = true;
  }

  function startNewProduct() {
    setEditingProductId(null);
    setProductFieldErrors({});
    setNewProduct({ name: "", description: "", ingredients: defaultProductIngredients, allergens: defaultProductAllergens, price6: "", price12: "" });
    setProductImages([]);
    setReferenceImageFiles([]);
    setImageDirection("");
    setGenerationStatus("");
  }

  async function removeProduct(id: string) {
    setProductStatus("Removing...");
    beginAdminAction("Removing product…");
    const response = await fetch(
      `/api/admin/products?id=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      finishAdminAction();
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
    finishAdminAction("Product successfully removed");
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
    const images: string[] = [];
    try {
      // Request frames individually so a complete rotation can exceed one
      // hosting request's duration without losing the generation job.
      for (let frameIndex = 0; frameIndex < generatedImageCount; frameIndex++) {
        setGenerationStatus(`Generating image ${frameIndex + 1} of ${generatedImageCount} with OpenAI...`);
        const formData = new FormData();
        formData.set("name", newProduct.name.trim());
        formData.set("direction", imageDirection.trim());
        formData.set("count", "1");
        formData.set("frameIndex", String(frameIndex));
        referenceImageFiles.forEach((file) => formData.append("references", file));
        const response = await fetch("/api/admin/product-images/generate", { method: "POST", body: formData });
        const result = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(result?.images)) throw new Error(result?.error || "Unable to generate an image.");
        images.push(...result.images);
      }
      setProductImages(images);
      setGenerationStatus(`${images.length} transparent PNGs generated. Side profile cover and eight rotation angles, opening bird’s-eye. Save the product to publish.`);
    } catch (error) {
      setGenerationStatus(error instanceof Error ? error.message : "Unable to generate images.");
    }
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
          {field.label}
        </label>
        {field.multiline ? (
          <textarea
            id={id}
            rows={field.rows ?? 5}
            className={field.rows ? "admin-textarea-compact" : field.body ? "admin-textarea-body" : undefined}
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
                fields: { ...content.fields, [field.key]: event.target.value },
              })
            }
          />
        )}
        <small className="admin-editor-count">
          {`${value.length} / ${field.maxLength}`}
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
        loadContent(
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
      } else loadContent(emptyContent(nextTab));
    }
  }

  function editEmailTemplate(template: EmailTemplate) {
    let body = content.fields[template.bodyField] || "";
    if (usesPickupAddress(template.bodyField)) body = withPickupAddress(body);
    if (template.bodyField === "enquiryBody") body = withEnquiryType(body);
    if (body !== (content.fields[template.bodyField] || "")) {
      const next = { ...content, fields: { ...content.fields, [template.bodyField]: body } };
      setContent(next);
      if (!contentChanged) setSavedContent(JSON.stringify(next));
    }
    setEmailTemplateKey(template.key);
  }

  async function saveContent(event: React.FormEvent) {
    event.preventDefault();
    const contentModule = contentModules[tab];
    if (!contentModule) return;
    if (
      contentModule.fields.some(
        (field) =>
          (content.fields[field.key] || "").length > field.maxLength,
      ) ||
      (tab === "policy" &&
        (content.sections || []).some(
          (section) => section.body.length > policyBodyMaxChars,
        ))
    ) {
      setContentStatus("Shorten the highlighted field before saving");
      return;
    }
    setContentStatus("Saving...");
    beginAdminAction(
      tab === "email templates" ? "Saving template…" : "Saving changes…",
    );
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
      setSavedContent(JSON.stringify(content));
      setContentStatus("");
      finishAdminAction(
        tab === "email templates" ? "Template successfully saved" : "Changes successfully saved",
      );
      return;
    }
    finishAdminAction();
    setContentStatus(
      (await response.json().catch(() => null))?.error || "Unable to save",
    );
  }

  if (!data && checkingSession)
    return (
      <div className="admin-auth admin-auth-loading" role="status" aria-live="polite">
        <h1>Admin portal</h1>
        <p>
          <span className="admin-auth-spinner" aria-hidden="true" />
          Signing you in
        </p>
      </div>
    );

  if (!data)
    return (
      <form className="admin-auth" onSubmit={login} noValidate>
        <h1>Admin portal</h1>
        <div className="admin-auth-row">
          <div className={`field${error ? " has-error" : ""}`}>
            <label htmlFor="password">Password</label>
            <div className="admin-password-wrap">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                disabled={signingIn}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                className="admin-password-toggle"
                onClick={() => setShowPassword((shown) => !shown)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3 3l18 18" />
                    <path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3.1 3.9M6.6 6.6C3.9 8.4 2.5 12 2.5 12S6 19 12 19a9.6 9.6 0 0 0 5.4-1.6" />
                    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          <button
            className={`btn btn-dark${signingIn ? " btn-loading" : ""}`}
            disabled={signingIn}
            aria-busy={signingIn}
          >
            {signingIn && <span className="btn-spinner" aria-hidden="true" />}
            {signingIn ? "Signing in…" : "Sign in"}
          </button>
        </div>
        {error && <p className="field-error" role="alert">{error}</p>}
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
        {!adminBusyMessage && adminNotice && (
          <div
            className={`admin-toast${adminNoticeLeaving ? " admin-toast-leaving" : ""}`}
            role="status"
            aria-live="polite"
          >
            <span>{adminNotice}</span>
            <button
              aria-label="Dismiss notification"
              type="button"
              onClick={() => dismissAdminNotice()}
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
                <input
                  id="pickup-modal-toggle"
                  type="checkbox"
                  hidden
                  onChange={(event) => {
                    if (event.target.checked) resetPickupForm();
                  }}
                />
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
          <table className="table admin-stack-table">
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
                    <td data-label="Customer">
                      {order.customer?.name}
                      <br />
                      <small>{order.customer?.email}</small>
                    </td>
                    <td data-label="Items">
                      {order.lines?.map((line, index) => (
                        <div key={index}>
                          {line.productName} · {line.variantLabel}{" "}
                          <span className="status">{line.status}</span>
                        </div>
                      ))}
                    </td>
                    <td data-label="Payment">
                      {order.paymentStatus
                        ? order.paymentStatus.charAt(0).toUpperCase() +
                          order.paymentStatus.slice(1)
                        : ""}
                    </td>
                    <td data-label="Created">{order.createdAt?.slice(0, 10)}</td>
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
          <table className="table admin-stack-table">
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
                    <td data-label="Name">
                      {enquiry.name}
                      <br />
                      <small>
                        {enquiry.email}
                        <br />
                        {enquiry.phone}
                      </small>
                    </td>
                    <td data-label="Request">{enquiry.request}</td>
                    <td data-label="Status">
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
            <form className="admin-modal admin-product-form" onSubmit={addProduct} noValidate>
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
                <div className={`field${productFieldErrors.name ? " has-error" : ""}`}>
                  <label htmlFor="product-name">Product name</label>
                  <input
                    id="product-name"
                    value={newProduct.name}
                    onChange={(event) =>
                      setNewProduct({ ...newProduct, name: event.target.value })
                    }
                  />
                  {productFieldErrors.name && (
                    <p className="field-error" role="alert">{productFieldErrors.name}</p>
                  )}
                </div>
                <div className={`field${productFieldErrors.price6 ? " has-error" : ""}`}>
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
                  {productFieldErrors.price6 && (
                    <p className="field-error" role="alert">{productFieldErrors.price6}</p>
                  )}
                </div>
                <div className={`field${productFieldErrors.price12 ? " has-error" : ""}`}>
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
                  {productFieldErrors.price12 && (
                    <p className="field-error" role="alert">{productFieldErrors.price12}</p>
                  )}
                </div>
                <div className={`field${productFieldErrors.description ? " has-error" : ""}`}>
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
                  {productFieldErrors.description && (
                    <p className="field-error" role="alert">{productFieldErrors.description}</p>
                  )}
                </div>
                <div className={`field${productFieldErrors.ingredients ? " has-error" : ""}`}>
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
                  />
                  {productFieldErrors.ingredients && (
                    <p className="field-error" role="alert">{productFieldErrors.ingredients}</p>
                  )}
                </div>
                <div className={`field${productFieldErrors.allergens ? " has-error" : ""}`}>
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
                  />
                  {productFieldErrors.allergens && (
                    <p className="field-error" role="alert">{productFieldErrors.allergens}</p>
                  )}
                </div>
                <fieldset className="admin-image-generator">
                  <legend>Product imagery</legend>
                  <p>
                    Add up to five reference photos and generate the complete
                    storefront image set. OpenAI automatically creates a
                    side-profile image, like the Signature Crumbie, as the
                    storefront cover; a bird’s-eye opening view and seven more angles become the
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
                  <label id="product-image-count-label">Images to generate</label>
                  <PremiumSelect
                    labelId="product-image-count-label"
                    value={String(generatedImageCount)}
                    options={[9].map((count) => ({
                      value: String(count),
                      label: `${count} image${count === 1 ? "" : "s"}${count === 9 ? " (recommended)" : ""}`,
                    }))}
                    placeholder="9 images (cover + full rotation)"
                    onChange={(value) => setGeneratedImageCount(Number(value))}
                  />
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
                <button
                  className={`btn btn-dark${
                    productStatus === "Saving..." || productStatus === "Publishing..."
                      ? " btn-loading"
                      : ""
                  }`}
                  disabled={
                    productStatus === "Saving..." ||
                    productStatus === "Publishing..." ||
                    !productChanged
                  }
                >
                  {(productStatus === "Saving..." ||
                    productStatus === "Publishing...") && (
                    <span className="btn-spinner" aria-hidden="true" />
                  )}
                  {productStatus === "Saving..."
                    ? "Saving…"
                    : productStatus === "Publishing..."
                      ? "Publishing…"
                      : editingProductId
                        ? "Save product"
                        : "Publish product"}
                </button>
                {productStatus &&
                  productStatus !== "Saving..." &&
                  productStatus !== "Publishing..." && <span>{productStatus}</span>}
              </div>
            </form>
            {!productsLoaded ? (
              <p className="admin-products-loading" role="status">
                Loading products...
              </p>
            ) : (
            <table className="table admin-pickup-table admin-product-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="admin-product-price">Six</th>
                  <th className="admin-product-price">Twelve</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {managedProducts.length ? (
                  managedProducts.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <div className="admin-product-name">{product.name}</div>
                        <div className="admin-product-description">
                          {product.description}
                        </div>
                      </td>
                      {[6, 12].map((quantity) => {
                        const variant = product.variants.find(
                          (item) => item.quantity === quantity,
                        );
                        return (
                          <td
                            className="admin-product-price"
                            data-label={quantity === 6 ? "Six" : "Twelve"}
                            key={quantity}
                          >
                            {variant ? `$${variant.price}` : "—"}
                          </td>
                        );
                      })}
                      <td className="admin-table-action">
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => editProduct(product)}
                        >
                          <svg className="admin-edit-icon" aria-hidden="true" viewBox="0 0 16 16" fill="none">
                            <path d="M11.2 2.3a1.4 1.4 0 0 1 2 2L5.5 12 2.5 13.5 4 10.5l7.2-8.2Z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => void removeProduct(product.id)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4}>No products</td>
                  </tr>
                )}
              </tbody>
            </table>
            )}
          </>
        )}
        {tab === "pickup dates" && (
          <>
            <form className="admin-modal admin-add-date" onSubmit={addPickupDate} noValidate>
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
              <div className="admin-modal-body" key={pickupFormKey}>
              <div className={`field${pickupFieldErrors.date ? " has-error" : ""}`}>
                <label htmlFor="new-pickup-date">Pickup date</label>
                <DatePicker
                  id="new-pickup-date"
                  value={newPickupDate}
                  onChange={setNewPickupDate}
                />
                {pickupFieldErrors.date && (
                  <p className="field-error" role="alert">{pickupFieldErrors.date}</p>
                )}
              </div>
              <div className="admin-time-range">
                <div className={`field${pickupFieldErrors.start ? " has-error" : ""}`}>
                  <label htmlFor="new-pickup-start">Start time</label>
                  <TimePicker
                    id="new-pickup-start"
                    label="Start time"
                    value={newPickupStart}
                    onChange={setNewPickupStart}
                  />
                  {pickupFieldErrors.start && (
                    <p className="field-error" role="alert">{pickupFieldErrors.start}</p>
                  )}
                </div>
                <div className={`field${pickupFieldErrors.end ? " has-error" : ""}`}>
                  <label htmlFor="new-pickup-end">End time</label>
                  <TimePicker
                    id="new-pickup-end"
                    label="End time"
                    value={newPickupEnd}
                    onChange={setNewPickupEnd}
                  />
                  {pickupFieldErrors.end && (
                    <p className="field-error" role="alert">{pickupFieldErrors.end}</p>
                  )}
                </div>
              </div>
              </div>
              <div className="admin-modal-actions">
                <button
                  className={`btn btn-dark${
                    pickupDateStatus === "Saving..." ? " btn-loading" : ""
                  }`}
                  disabled={pickupDateStatus === "Saving..."}
                >
                  {pickupDateStatus === "Saving..." && (
                    <span className="btn-spinner" aria-hidden="true" />
                  )}
                  {pickupDateStatus === "Saving..." ? "Adding…" : "Add pickup date"}
                </button>
                {pickupDateStatus && pickupDateStatus !== "Saving..." && (
                  <span>{pickupDateStatus}</span>
                )}
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
            {(() => {
              const visiblePickupDates = managedPickupDates.filter(
                (pickupDate) =>
                  pickupFilter === "all" ||
                  (pickupFilter === "closed"
                    ? isDateClosed(pickupDate)
                    : !isDateClosed(pickupDate)),
              );
              return (
                <table className="table admin-pickup-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Pickup window</th>
                      <th>Status</th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visiblePickupDates.length ? (
                      visiblePickupDates.map((pickupDate) => {
                        const closed = isDateClosed(pickupDate);
                        return (
                          <tr key={pickupDate.id}>
                            <td>{formatPickupDate(pickupDate.date)}</td>
                            <td>{pickupDate.window}</td>
                            <td>
                              <span
                                className={
                                  closed ? "status" : "status status-live"
                                }
                              >
                                {closed ? "Closed" : "Open"}
                              </span>
                            </td>
                            <td className="admin-table-action">
                              <button
                                className="text-button"
                                type="button"
                                onClick={() =>
                                  requestPickupDateRemoval(pickupDate)
                                }
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4}>No pickup dates</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              );
            })()}
          </>
        )}
        {tab === "email templates" && !emailTemplateKey && (
          <table className="table admin-pickup-table admin-template-table">
            <thead>
              <tr>
                <th>Template</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {emailTemplates.map((template) => (
                <tr key={template.key}>
                  <td>{template.name}</td>
                  <td className="admin-table-action">
                    <button className="text-button" type="button" onClick={() => editEmailTemplate(template)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {tab === "email templates" && emailTemplateKey && (() => {
          const template = emailTemplates.find((item) => item.key === emailTemplateKey);
          if (!template) return null;
          return <form className="enquiry-form admin-editor" onSubmit={saveContent}>
            <div className="admin-template-editor-heading"><button className="text-button" type="button" onClick={() => setEmailTemplateKey(null)}><svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="m10 3-5 5 5 5" /></svg>Back to templates</button><h2>{template.name}</h2><p>{template.description}</p></div>
            <div className="admin-editor-fields">
              <div className="field"><label htmlFor="email-template-subject">Subject</label><input id="email-template-subject" maxLength={140} value={content.fields[template.subjectField] || ""} onChange={(event) => setContent({ ...content, fields: { ...content.fields, [template.subjectField]: event.target.value } })} /><small className="admin-editor-count">{(content.fields[template.subjectField] || "").length} / 140</small></div>
              <div className="field"><label htmlFor="email-template-body">Body copy</label><textarea id="email-template-body" rows={12} maxLength={3000} value={content.fields[template.bodyField] || ""} onChange={(event) => setContent({ ...content, fields: { ...content.fields, [template.bodyField]: event.target.value } })} /><div className="admin-editor-meta">{usesPickupAddress(template.bodyField) && <small className="admin-editor-hint">{pickupAddressToken} is always replaced with the pickup address in Settings.</small>}<small className="admin-editor-count">{(content.fields[template.bodyField] || "").length} / 3000</small></div></div>
            </div>
            <div className="admin-editor-actions"><button className={`btn btn-light${contentStatus === "Saving..." ? " btn-loading" : ""}`} disabled={contentStatus === "Saving..." || !contentChanged}>{contentStatus === "Saving..." && <span className="btn-spinner" aria-hidden="true" />}{contentStatus === "Saving..." ? "Saving…" : "Save template"}</button>{contentStatus && contentStatus !== "Saving..." && <span>{contentStatus}</span>}</div>
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
              {tab === "contact us" && (() => {
                const types = (content.fields.enquiryTypes ?? defaultEnquiryTypes.join("\n")).split("\n");
                const setTypes = (next: string[]) =>
                  setContent({ ...content, fields: { ...content.fields, enquiryTypes: next.join("\n") } });
                const moveType = (from: number, to: number) => {
                  if (from === to || to < 0 || to >= types.length) return;
                  const next = [...types];
                  const [moved] = next.splice(from, 1);
                  next.splice(to, 0, moved);
                  setTypes(next);
                };
                return (
                  <div className="admin-enquiry-types">
                    <div className="admin-enquiry-types-heading">
                      <h3>Enquiry types</h3>
                      <button
                        className="text-button admin-add-text-button"
                        type="button"
                        onClick={(event) => {
                          const container = event.currentTarget.closest(".admin-enquiry-types");
                          setTypes([...types, ""]);
                          requestAnimationFrame(() => {
                            const inputs = container?.querySelectorAll<HTMLInputElement>("tbody input");
                            const input = inputs?.[inputs.length - 1];
                            if (!input) return;
                            input.scrollIntoView({ behavior: "smooth", block: "center" });
                            input.focus({ preventScroll: true });
                          });
                        }}
                      >
                        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" /></svg>
                        Add enquiry type
                      </button>
                    </div>
                    <table className="table admin-enquiry-table">
                      <tbody>
                        {types.map((type, index) => (
                          <tr
                            key={`enquiry-type-${index}`}
                            className={draggedEnquiryType === index ? "is-dragging" : undefined}
                            onDragOver={(event) => {
                              if (draggedEnquiryType === null) return;
                              event.preventDefault();
                              if (draggedEnquiryType !== index) {
                                moveType(draggedEnquiryType, index);
                                setDraggedEnquiryType(index);
                              }
                            }}
                            onDrop={(event) => {
                              event.preventDefault();
                              setDraggedEnquiryType(null);
                            }}
                          >
                            <td className="admin-enquiry-handle-cell">
                              <button
                                className="admin-drag-handle"
                                type="button"
                                draggable
                                aria-label={`Reorder ${type || "enquiry type"}. Use arrow keys to move.`}
                                disabled={types.length <= 1}
                                onDragStart={(event) => {
                                  const row = event.currentTarget.closest("tr");
                                  if (row) event.dataTransfer.setDragImage(row, 24, row.offsetHeight / 2);
                                  event.dataTransfer.effectAllowed = "move";
                                  event.dataTransfer.setData("text/plain", String(index));
                                  setDraggedEnquiryType(index);
                                }}
                                onDragEnd={() => setDraggedEnquiryType(null)}
                                onKeyDown={(event) => {
                                  const offset = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
                                  if (!offset) return;
                                  event.preventDefault();
                                  const target = index + offset;
                                  if (target < 0 || target >= types.length) return;
                                  const tbody = event.currentTarget.closest("tbody");
                                  moveType(index, target);
                                  requestAnimationFrame(() =>
                                    tbody?.querySelectorAll<HTMLButtonElement>(".admin-drag-handle")[target]?.focus(),
                                  );
                                }}
                              >
                                <svg aria-hidden="true" viewBox="0 0 16 16" fill="currentColor">
                                  <circle cx="6" cy="4" r="1.1" />
                                  <circle cx="10" cy="4" r="1.1" />
                                  <circle cx="6" cy="8" r="1.1" />
                                  <circle cx="10" cy="8" r="1.1" />
                                  <circle cx="6" cy="12" r="1.1" />
                                  <circle cx="10" cy="12" r="1.1" />
                                </svg>
                              </button>
                            </td>
                            <td>
                              <input
                                aria-label={`Enquiry type ${index + 1}`}
                                maxLength={enquiryTypeMaxLength}
                                placeholder="Enquiry type name"
                                value={type}
                                onBlur={(event) => {
                                  if (!event.target.value.trim() && types.length > 1) {
                                    setTypes(types.filter((_, itemIndex) => itemIndex !== index));
                                  }
                                }}
                                onChange={(event) =>
                                  setTypes(types.map((item, itemIndex) => (itemIndex === index ? event.target.value.replace(/\n/g, " ") : item)))
                                }
                              />
                            </td>
                            <td className="admin-enquiry-tag-cell">
                              {index === 0 ? <span className="admin-default-tag">Default</span> : null}
                            </td>
                            <td className="admin-table-action">
                              <button
                                className="text-button"
                                type="button"
                                disabled={types.length <= 1}
                                onClick={() => setTypes(types.filter((_, itemIndex) => itemIndex !== index))}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
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
                          Heading
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
                          Body copy
                        </label>
                        <textarea
                          id={`policy-section-body-${index}`}
                          rows={5}
                          className="admin-textarea-body"
                          maxLength={policyBodyMaxChars}
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
                          {section.body.length} / {policyBodyMaxChars}
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
              <button
                className={`btn btn-light${
                  contentStatus === "Saving..." ? " btn-loading" : ""
                }`}
                disabled={contentStatus === "Saving..." || !contentChanged}
              >
                {contentStatus === "Saving..." && (
                  <span className="btn-spinner" aria-hidden="true" />
                )}
                {contentStatus === "Saving..." ? "Saving…" : "Save changes"}
              </button>
              {contentStatus && contentStatus !== "Saving..." && (
                <span>{contentStatus}</span>
              )}
            </div>
          </form>
        )}
        {tab === "settings" && config && (
          <div className="admin-config-grid">
            {Object.entries(config).map(([name, ready]) => (
              <div className="admin-config-item" key={name}>
                <span>{configLabels[name as keyof Config] || name}</span>
                <strong className={ready ? "status status-live" : "status"}>
                  {ready ? "Configured" : name === "r2" ? "Local storage only" : "Missing"}
                </strong>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
