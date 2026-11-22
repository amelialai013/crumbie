"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { TimePicker } from "./time-picker";
import { DatePicker } from "./date-picker";
import PremiumSelect from "./premium-select";
import { enquiryMessageDisplay } from "@/lib/enquiry-display";
import { formatPickupDate } from "@/lib/format-date";
import AdminSwitch from "@/components/admin-switch";
import { deliveryFrom, postcodesWithinKm } from "@/lib/delivery";
import { routeFromIvanhoe } from "@/lib/delivery-route";
import switchStyles from "@/components/admin-switch.module.css";
import { policyBodyMaxChars } from "@/lib/text-limits";
import { privacyBodyMaxChars, privacyDefaultTitle, privacyDefaults } from "@/lib/privacy";
import { termsBodyMaxChars, termsDefaultTitle, termsDefaults } from "@/lib/terms";
import { defaultCardOption, defaultUnavailableMessage } from "@/lib/card";
import { defaultAddressErrorMessage, defaultDeliverableMessage, defaultDeliveryInfo, defaultUndeliverableMessage } from "@/lib/delivery";
import { defaultEnquiryTypes, enquiryTypeLabels, enquiryTypeMaxLength, pickupAddressToken, withEnquiryType, withPickupAddress } from "@/lib/email-templates";

const usesPickupAddress = (field: string) => field === "confirmationBody" || field === "pickupReminderBody";
import {
  defaultProductAllergens,
  defaultProductIngredients,
  GENERATED_IMAGE_COUNTS,
  isDateClosed,
  RECOMMENDED_IMAGE_COUNT,
  ROTATION_FRAME_PLANS,
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
  fulfilment?: "pickup" | "delivery";
  deliverySlot?: { date?: string; window?: string };
  delivery?: { name?: string; street?: string; suburb?: string; postcode?: string };
  paymentStatus?: string;
  card?: { label?: string; price?: number; quantity?: number; names?: string[]; messages?: string[]; products?: string[] } | null;
  lines?: Array<{
    productName?: string;
    variantLabel?: string;
    quantity?: number;
    unitPrice?: number;
    pickupDateId?: string;
    pickupDate?: string;
    pickupWindow?: string;
    status?: string;
  }>;
};
type Enquiry = {
  gmailThreaded?: boolean;
  gmailSubject?: string;
  id?: string;
  name?: string;
  email?: string;
  phone?: string;
  request?: string;
  status?: string;
  enquiryType?: string;
  createdAt?: string;
  repliedAt?: string;
  readAt?: string;
  replies?: Array<{ subject: string; message: string; sentAt: string; source?: "gmail"; direction?: "incoming" | "outgoing"; externalId?: string }>;
};
const DISMISSED_ENQUIRY_ALERTS_KEY = "crumbie-dismissed-enquiry-alerts";

function readDismissedEnquiryIds(): Set<string> | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = JSON.parse(localStorage.getItem(DISMISSED_ENQUIRY_ALERTS_KEY) || "[]");
    return new Set(Array.isArray(stored) ? stored : []);
  } catch {
    return new Set();
  }
}

// Vercel rejects request bodies over 4.5MB, so shrink phone photos before upload.
const REFERENCE_UPLOAD_BUDGET = 3.5 * 1024 * 1024;
const REFERENCE_COMPRESSION_STEPS = [
  { maxSide: 1536, quality: 0.85 },
  { maxSide: 1280, quality: 0.8 },
  { maxSide: 1024, quality: 0.75 },
  { maxSide: 768, quality: 0.7 },
];

async function compressReferenceImage(file: File, maxSide: number, quality: number): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }
  context.fillStyle = "#fff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob || blob.size >= file.size) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

async function compressReferenceImages(files: File[]): Promise<File[]> {
  let result = files;
  for (const { maxSide, quality } of REFERENCE_COMPRESSION_STEPS) {
    result = await Promise.all(files.map((file) => compressReferenceImage(file, maxSide, quality)));
    if (result.reduce((total, file) => total + file.size, 0) <= REFERENCE_UPLOAD_BUDGET) break;
  }
  return result;
}

const previewUrls = new WeakMap<File, string>();

function PendingPhotoPreview({ file }: { file: File }) {
  let url = previewUrls.get(file);
  if (!url) {
    url = URL.createObjectURL(file);
    previewUrls.set(file, url);
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" width={56} height={44} />;
}

function PhotoReorderList({
  images,
  files,
  label,
  onImagesChange,
  onFilesChange,
}: {
  images: string[];
  files: File[];
  label: (index: number) => string;
  onImagesChange: (images: string[]) => void;
  onFilesChange: (files: File[]) => void;
}) {
  const [dragged, setDragged] = useState<number | null>(null);

  function move(from: number, to: number) {
    const next = [...images];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onImagesChange(next);
  }

  return (
    <ol className="admin-product-images">
      {images.map((image, index) => (
        <li
          key={image}
          className={dragged === index ? "is-dragging" : undefined}
          onDragOver={(event) => {
            if (dragged === null) return;
            event.preventDefault();
            if (dragged !== index) {
              move(dragged, index);
              setDragged(index);
            }
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragged(null);
          }}
        >
          <button
            className="admin-drag-handle"
            type="button"
            draggable
            aria-label={`Reorder ${label(index)}. Use arrow keys to move.`}
            disabled={images.length <= 1}
            onDragStart={(event) => {
              const row = event.currentTarget.closest("li");
              if (row) event.dataTransfer.setDragImage(row, 24, row.offsetHeight / 2);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", String(index));
              setDragged(index);
            }}
            onDragEnd={() => setDragged(null)}
            onKeyDown={(event) => {
              const offset = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
              if (!offset) return;
              event.preventDefault();
              const target = index + offset;
              if (target < 0 || target >= images.length) return;
              const list = event.currentTarget.closest("ol");
              move(index, target);
              requestAnimationFrame(() =>
                list?.querySelectorAll<HTMLButtonElement>(".admin-drag-handle")[target]?.focus(),
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
          <Image src={image} alt="" width={56} height={44} unoptimized />
          <div>
            <strong>{label(index)}</strong>
            <span>{image.split("/").pop()}</span>
          </div>
          <div className="admin-product-image-actions">
            <button className="text-button" type="button" onClick={() => onImagesChange(images.filter((_, i) => i !== index))}>
              Remove
            </button>
          </div>
        </li>
      ))}
      {files.map((file, index) => (
        <li key={`${file.name}-${file.size}-${index}`}>
          <div aria-hidden="true" />
          <PendingPhotoPreview file={file} />
          <div>
            <strong>New photo (saved on save)</strong>
            <span>{file.name}</span>
          </div>
          <div className="admin-product-image-actions">
            <button className="text-button" type="button" onClick={() => onFilesChange(files.filter((_, i) => i !== index))}>
              Remove
            </button>
          </div>
        </li>
      ))}
    </ol>
  );
}

function isUnreplied(enquiry: Enquiry) {
  return Boolean(enquiry.id) && enquiry.status !== "replied";
}

function isUnread(enquiry: Enquiry) {
  return isUnreplied(enquiry) && !enquiry.readAt;
}

function enquiryDisplayStatus(enquiry: Enquiry) {
  if (enquiry.status === "replied") return { key: "replied", label: "Replied" };
  if (!enquiry.readAt) return { key: "new", label: "New" };
  return { key: "pending", label: "Pending" };
}

function enquiryTypeLabel(enquiry: Enquiry) {
  return enquiryTypeLabels[enquiry.enquiryType || ""] || enquiry.enquiryType || "General enquiry";
}

function EnquiryStatus({ enquiry }: { enquiry: Enquiry }) {
  const { key, label } = enquiryDisplayStatus(enquiry);
  return (
    <span className="status admin-enquiry-status">
      <span className={`admin-status-dot is-${key}`} aria-hidden="true" />
      {label}
    </span>
  );
}
const DEFAULT_REPLY_SUBJECT = "Re: your Club Crumbie enquiry";
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

const LAST_TAB_KEY = "admin-last-tab";
const adminTabs = [
  "orders",
  "pickup schedule",
  "delivery schedule",
  "enquiries",
  "products",
  "pickup windows",
  "delivery windows",
  "page content",
  "email templates",
  "settings",
];
const pageContentModules: [string, string][] = [
  ["homepage", "Homepage"],
  ["about", "About"],
  ["contact us", "Contact us"],
  ["faqs", "FAQs"],
  ["terms of service", "Terms of service"],
  ["privacy policy", "Privacy policy"],
  ["order confirmation", "Order confirmation"],
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
      { key: "howTitle", label: "Secondary heading", maxLength: 40 },
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
        stepOneBody: "Pick a curated collection in a box of four, six or twelve.",
        stepTwoTitle: "Select pickup",
        stepTwoBody:
          "Choose an available pickup window in Ivanhoe, Victoria.",
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
  faqs: {
    fields: [
      { key: "pageTitle", label: "Page heading", maxLength: 80 },
      { key: "pickupHeading", label: "Question 1", maxLength: 80 },
      { key: "pickupCopy", label: "Answer 1", maxLength: policyBodyMaxChars, body: true, multiline: true },
      { key: "deadlineHeading", label: "Question 2", maxLength: 80 },
      { key: "deadlineCopy", label: "Answer 2", maxLength: policyBodyMaxChars, body: true, multiline: true },
      { key: "paymentHeading", label: "Question 3", maxLength: 80 },
      { key: "paymentCopy", label: "Answer 3", maxLength: policyBodyMaxChars, body: true, multiline: true },
      { key: "cancellationHeading", label: "Question 4", maxLength: 80 },
      { key: "cancellationCopy", label: "Answer 4", maxLength: policyBodyMaxChars, body: true, multiline: true },
      { key: "allergenHeading", label: "Question 5", maxLength: 80 },
      { key: "allergenCopy", label: "Answer 5", maxLength: policyBodyMaxChars, body: true, multiline: true },
      { key: "enquiryHeading", label: "Question 6", maxLength: 80 },
      { key: "enquiryCopy", label: "Answer 6", maxLength: policyBodyMaxChars, body: true, multiline: true },
    ],
    defaults: {
      fields: {
        pageTitle: "FAQs",
        pickupHeading: "Where do I pick up my order?",
        pickupCopy:
          "Club Crumbie currently offers pickup only from Ivanhoe, Victoria. Choose a pickup window at checkout. The exact address is sent in your confirmation email after payment.",
        deadlineHeading: "When do orders close?",
        deadlineCopy:
          "Standard box orders close 72 hours before their pickup window. A window or individual product may sell out earlier.",
        paymentHeading: "How do I pay?",
        paymentCopy:
          "Payment is taken securely by Stripe at checkout and your order is confirmed straight away. Prices are in Australian dollars and include GST where applicable.",
        cancellationHeading: "Can I cancel or get a refund?",
        cancellationCopy:
          "Every order is made for its scheduled pickup, so change-of-mind cancellations aren't accepted. If something is wrong with your order, get in touch. Nothing here limits your rights under Australian Consumer Law.",
        allergenHeading: "Do your products contain allergens?",
        allergenCopy:
          "Yes. Club Crumbie handles gluten, dairy, eggs, soy, peanuts and tree nuts, and cross-contact is possible. We can't accommodate allergy requests for standard boxes.",
        enquiryHeading: "Does a custom enquiry confirm my order?",
        enquiryCopy:
          "No. Submitting the custom-order form is an enquiry only. It doesn't confirm availability, pricing or an order until we reply.",
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
Pickup window: {{pickupDate}}
Pickup window: {{pickupWindow}}
Order total: {{orderTotal}}
Pickup address: {{pickupAddress}}

Please keep this email for your records. We look forward to sharing your crumbs with you.

Club Crumbie`,
        pickupReminderSubject: "Your Club Crumbie pickup is coming up",
        pickupReminderBody: `Hi {{customerName}},

Just a reminder that your Club Crumbie order is ready for pickup soon.

Pickup window: {{pickupDate}}
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
      { key: "cardEnabled", label: "Card add-on enabled", maxLength: 5 },
      { key: "cardPrice", label: "Card price (AUD)", maxLength: 8 },
    ],
  },
  "terms of service": {
    fields: [
      { key: "pageTitle", label: "Page heading", maxLength: 80 },
      ...termsDefaults.flatMap((_, i) => [
        { key: `s${i + 1}Heading`, label: `Section ${i + 1} heading`, maxLength: 80 },
        { key: `s${i + 1}Copy`, label: `Section ${i + 1} body copy`, maxLength: termsBodyMaxChars, multiline: true },
      ]),
    ],
    defaults: {
      fields: {
        pageTitle: termsDefaultTitle,
        ...Object.fromEntries(termsDefaults.flatMap((section, i) => [[`s${i + 1}Heading`, section.heading], [`s${i + 1}Copy`, section.body]])),
      },
    },
  },
  "privacy policy": {
    fields: [
      { key: "pageTitle", label: "Page heading", maxLength: 80 },
      ...privacyDefaults.flatMap((_, i) => [
        { key: `s${i + 1}Heading`, label: `Section ${i + 1} heading`, maxLength: 80 },
        { key: `s${i + 1}Copy`, label: `Section ${i + 1} body copy`, maxLength: privacyBodyMaxChars, multiline: true },
      ]),
    ],
    defaults: {
      fields: {
        pageTitle: privacyDefaultTitle,
        ...Object.fromEntries(privacyDefaults.flatMap((section, i) => [[`s${i + 1}Heading`, section.heading], [`s${i + 1}Copy`, section.body]])),
      },
    },
  },
  "order confirmation": {
    fields: [
      { key: "pageTitle", label: "Page heading", maxLength: 80 },
      { key: "message", label: "Message", maxLength: 600, multiline: true },
      { key: "buttonLabel", label: "Button label", maxLength: 40 },
    ],
    defaults: {
      fields: {
        pageTitle: "Your cookie order is received.",
        message:
          "We’ll send confirmation to the email used at checkout once payment is complete. Pickup is in Ivanhoe; until the final address is configured, exact pickup details will be provided separately.",
        buttonLabel: "Back to crumbs",
      },
    },
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

function cleanPriceInput(value: string) {
  const [whole, ...rest] = value.replace(/[^0-9.]/g, "").split(".");
  return rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
}

function formatPriceInput(value: string) {
  const amount = Number(value);
  return value.trim() && Number.isFinite(amount) ? amount.toFixed(2) : "";
}

function normalizeCardSettings(data: { fields?: Record<string, string> } | null) {
  const next = { ...(data?.fields ?? {}) };
  next.cardPrice = next.cardPrice === undefined ? "3.00" : Number.isFinite(Number(next.cardPrice)) && next.cardPrice.trim() ? Number(next.cardPrice).toFixed(2) : "";
  return next;
}

const CARD_KEYS = ["cardEnabled", "cardPrice", "cardLabel", "cardDescription", "cardNamePlaceholder", "cardNameMaxLength", "cardMessagePlaceholder", "cardMessageMaxLength"];
const PAGE_KEYS = ["galleryTitle", "galleryBody", "galleryImages"];
const BANNER_KEYS = ["exploreTitle", "exploreSubtext"];
const SEARCH_KEYS = ["searchImage"];

function CardSettings({
  part,
  begin,
  finish,
  initial,
}: {
  part: "card" | "page" | "banner" | "search";
  begin: (message: string) => void;
  finish: (message?: string) => void;
  initial: Record<string, string>;
}) {
  const keys = part === "card" ? CARD_KEYS : part === "banner" ? BANNER_KEYS : part === "search" ? SEARCH_KEYS : PAGE_KEYS;
  const [fields, setFields] = useState<Record<string, string> | null>(initial);
  const [saved, setSaved] = useState(() => JSON.stringify(keys.map((key) => initial[key])));
  const [status, setStatus] = useState("");
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryDragActive, setGalleryDragActive] = useState(false);
  const [searchFile, setSearchFile] = useState<File | null>(null);
  const searchPreview = useMemo(() => (searchFile ? URL.createObjectURL(searchFile) : ""), [searchFile]);
  const addGalleryFiles = (picked: File[]) =>
    setGalleryFiles((current) => [...current, ...picked.filter((file) => file.type.startsWith("image/"))]);

  if (!fields) return null;
  const galleryImages: string[] = (() => {
    try {
      const parsed = JSON.parse(fields.galleryImages || "[]");
      return Array.isArray(parsed) ? parsed.filter((image): image is string => typeof image === "string") : [];
    } catch {
      return [];
    }
  })();
  const setGalleryImages = (next: string[]) => setFields({ ...fields, galleryImages: JSON.stringify(next) });
  const changed = JSON.stringify(keys.map((key) => fields[key])) !== saved || galleryFiles.length > 0 || searchFile !== null;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setStatus("Saving...");
    begin("Saving changes…");
    let nextFields = fields!;
    if (galleryFiles.length > 0) {
      const upload = new FormData();
      for (const file of await compressReferenceImages(galleryFiles)) upload.append("files", file);
      const uploaded = await fetch("/api/admin/gallery", { method: "POST", body: upload });
      const result = await uploaded.json().catch(() => null);
      if (!uploaded.ok) {
        finish();
        setStatus(result?.error || "Unable to upload photos");
        return;
      }
      nextFields = { ...nextFields, galleryImages: JSON.stringify([...galleryImages, ...(result?.urls ?? [])]) };
    }
    if (searchFile) {
      const upload = new FormData();
      upload.append("files", (await compressReferenceImages([searchFile]))[0]);
      const uploaded = await fetch("/api/admin/gallery", { method: "POST", body: upload });
      const result = await uploaded.json().catch(() => null);
      if (!uploaded.ok || !result?.urls?.[0]) {
        finish();
        setStatus(result?.error || "Unable to upload photo");
        return;
      }
      nextFields = { ...nextFields, searchImage: result.urls[0] };
    }
    const latest = await fetch("/api/admin/content?module=settings").then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const response = await fetch("/api/admin/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module: "settings", fields: { ...(latest?.fields ?? {}), ...Object.fromEntries(keys.map((key) => [key, nextFields[key] ?? ""])) } }),
    });
    if (response.ok) {
      setFields(nextFields);
      setGalleryFiles([]);
      setSearchFile(null);
      setSaved(JSON.stringify(keys.map((key) => nextFields[key])));
      setStatus("");
      finish("Changes successfully saved");
      return;
    }
    finish();
    setStatus((await response.json().catch(() => null))?.error || "Unable to save");
  }

  return (
    <form className="enquiry-form admin-editor admin-card-settings" onSubmit={save}>
      <div className="admin-editor-fields">
        {part === "card" && (<>
        <div className="admin-card-pair">
          <div className="field admin-card-toggle-field">
            <label htmlFor="content-cardEnabled">Club Crumbie Card</label>
            <label className="admin-card-toggle" htmlFor="content-cardEnabled">
            <input
              id="content-cardEnabled"
              type="checkbox"
              checked={fields.cardEnabled !== "false"}
              onChange={(event) => setFields({ ...fields, cardEnabled: event.target.checked ? "true" : "false" })}
            />
            <span className="admin-card-check" aria-hidden="true">
              <svg viewBox="0 0 20 20"><path d="m5 10.5 3.2 3.2L15 6.8" /></svg>
            </span>
            <span>Offer a card at checkout</span>
            </label>
          </div>
          <div className={`field admin-card-price${fields.cardEnabled === "false" ? " is-disabled" : ""}`}>
            <label htmlFor="content-cardPrice">Card price (AUD)</label>
            <div className="admin-card-price-input">
              {fields.cardPrice?.trim() && <span aria-hidden="true">$</span>}
              <input
                id="content-cardPrice"
                inputMode="decimal"
                maxLength={8}
                disabled={fields.cardEnabled === "false"}
                placeholder="Free"
                value={fields.cardPrice ?? ""}
                onChange={(event) => {
                  const [whole, ...rest] = event.target.value.replace(/[^0-9.]/g, "").split(".");
                  const cleaned = rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole;
                  setFields({ ...fields, cardPrice: cleaned });
                }}
                onBlur={() => {
                  const amount = Number(fields.cardPrice);
                  setFields({ ...fields, cardPrice: Number.isFinite(amount) && fields.cardPrice?.trim() ? amount.toFixed(2) : "" });
                }}
              />
            </div>
          </div>
        </div>
        <div className="field">
          <label htmlFor="content-cardLabel">Card title</label>
          <input
            id="content-cardLabel"
            maxLength={60}
            placeholder="Card title"
            value={fields.cardLabel ?? ""}
            onChange={(event) => setFields({ ...fields, cardLabel: event.target.value })}
          />
          <small className="admin-editor-count">{(fields.cardLabel ?? "").length} / 60</small>
        </div>
        <div className="field">
          <label htmlFor="content-cardDescription">Card description</label>
          <textarea
            id="content-cardDescription"
            className="admin-textarea-lines"
            style={{ "--lines": 3 } as React.CSSProperties}
            maxLength={200}
            placeholder="Leave blank to hide the description"
            value={fields.cardDescription ?? defaultCardOption.description}
            onChange={(event) => setFields({ ...fields, cardDescription: event.target.value })}
          />
          <small className="admin-editor-count">{(fields.cardDescription ?? defaultCardOption.description).length} / 200</small>
        </div>
        <div className="field">
          <label htmlFor="content-cardNamePlaceholder">Name field placeholder</label>
          <textarea
            id="content-cardNamePlaceholder"
            className="admin-textarea-lines"
            style={{ "--lines": 2 } as React.CSSProperties}
            maxLength={120}
            placeholder="Leave blank to show no placeholder text"
            value={fields.cardNamePlaceholder ?? defaultCardOption.namePlaceholder}
            onChange={(event) => setFields({ ...fields, cardNamePlaceholder: event.target.value.replace(/\n/g, " ") })}
          />
          <small className="admin-editor-count">{(fields.cardNamePlaceholder ?? defaultCardOption.namePlaceholder).length} / 120</small>
        </div>
        <div className="field">
          <label htmlFor="content-cardNameMaxLength">Name character limit (5–60)</label>
          <input
            id="content-cardNameMaxLength"
            inputMode="numeric"
            maxLength={2}
            placeholder={String(defaultCardOption.nameMaxLength)}
            value={fields.cardNameMaxLength ?? ""}
            onChange={(event) => setFields({ ...fields, cardNameMaxLength: event.target.value.replace(/\D/g, "") })}
            onBlur={() => {
              if (fields.cardNameMaxLength?.trim()) setFields({ ...fields, cardNameMaxLength: String(Math.min(60, Math.max(5, Number(fields.cardNameMaxLength)))) });
            }}
          />
        </div>
        <div className="field">
          <label htmlFor="content-cardMessagePlaceholder">Card message placeholder</label>
          <textarea
            id="content-cardMessagePlaceholder"
            className="admin-textarea-lines"
            style={{ "--lines": 2 } as React.CSSProperties}
            maxLength={160}
            placeholder="Leave blank to show no placeholder text"
            value={fields.cardMessagePlaceholder ?? defaultCardOption.messagePlaceholder}
            onChange={(event) => setFields({ ...fields, cardMessagePlaceholder: event.target.value.replace(/\n/g, " ") })}
          />
          <small className="admin-editor-count">{(fields.cardMessagePlaceholder ?? defaultCardOption.messagePlaceholder).length} / 160</small>
        </div>
        <div className="field">
          <label htmlFor="content-cardMessageMaxLength">Message character limit (20–500)</label>
          <input
            id="content-cardMessageMaxLength"
            inputMode="numeric"
            maxLength={3}
            placeholder={String(defaultCardOption.messageMaxLength)}
            value={fields.cardMessageMaxLength ?? ""}
            onChange={(event) => setFields({ ...fields, cardMessageMaxLength: event.target.value.replace(/\D/g, "") })}
            onBlur={() => {
              if (fields.cardMessageMaxLength?.trim()) setFields({ ...fields, cardMessageMaxLength: String(Math.min(500, Math.max(20, Number(fields.cardMessageMaxLength)))) });
            }}
          />
        </div>
        </>)}
        {part === "page" && (<>
        <div className="field">
          <label htmlFor="content-galleryTitle">Gallery heading</label>
          <input
            id="content-galleryTitle"
            maxLength={80}
            value={fields.galleryTitle ?? ""}
            onChange={(event) => setFields({ ...fields, galleryTitle: event.target.value })}
          />
          <small className="admin-editor-count">{(fields.galleryTitle ?? "").length} / 80</small>
        </div>
        <div className="field">
          <label htmlFor="content-galleryBody">Gallery copy</label>
          <textarea
            id="content-galleryBody"
            className="admin-textarea-lines"
            style={{ "--lines": 4 } as React.CSSProperties}
            maxLength={300}
            value={fields.galleryBody ?? ""}
            onChange={(event) => setFields({ ...fields, galleryBody: event.target.value })}
          />
          <small className="admin-editor-count">{(fields.galleryBody ?? "").length} / 300</small>
        </div>
        <div className="field admin-gallery-field">
          <label htmlFor="content-galleryPhotos">Gallery photos</label>
          <p>Photos shown in a gallery underneath the order information on every product page.</p>
          <label
            className={`admin-reference-dropzone admin-gallery-dropzone${galleryDragActive ? " is-active" : ""}`}
            htmlFor="content-galleryPhotos"
            tabIndex={0}
            onDragEnter={(event) => {
              event.preventDefault();
              setGalleryDragActive(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              if (event.currentTarget === event.target) setGalleryDragActive(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setGalleryDragActive(false);
              addGalleryFiles(Array.from(event.dataTransfer.files));
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                document.getElementById("content-galleryPhotos")?.click();
              }
            }}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V5m0 0L8 9m4-4 4 4M5 15v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3" />
            </svg>
            <span>Click to upload photos</span>
            <small>or drag and drop · JPG, PNG or WebP</small>
            <input
              id="content-galleryPhotos"
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => {
                addGalleryFiles(Array.from(event.target.files || []));
                event.target.value = "";
              }}
            />
          </label>
          {(galleryImages.length > 0 || galleryFiles.length > 0) && (
            <PhotoReorderList
              images={galleryImages}
              files={galleryFiles}
              label={(index) => `Gallery photo ${index + 1}`}
              onImagesChange={setGalleryImages}
              onFilesChange={setGalleryFiles}
            />
          )}
        </div>
        </>)}
        {part === "search" && (<>
        <div className="field admin-gallery-field">
          <label htmlFor="content-searchImage">Search &amp; sharing image</label>
          <p>The thumbnail shown beside your site in Google results and when the link is shared. Google can take days or weeks to refresh it.</p>
          <label className="admin-reference-dropzone admin-gallery-dropzone" htmlFor="content-searchImage" tabIndex={0}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith("image/"));
              if (file) setSearchFile(file);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                document.getElementById("content-searchImage")?.click();
              }
            }}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V5m0 0L8 9m4-4 4 4M5 15v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3" />
            </svg>
            <span>Click to upload a photo</span>
            <small>or drag and drop · JPG, PNG or WebP</small>
            <input id="content-searchImage" type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) setSearchFile(file); event.target.value = ""; }} />
          </label>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={searchPreview || fields.searchImage || "/og-image.jpg"} alt="Search thumbnail" style={{ width: "100%", maxWidth: 320, aspectRatio: "16 / 9", objectFit: "cover", borderRadius: 12, marginTop: 12 }} />
          {(fields.searchImage || searchFile) && (
            <button type="button" className="text-button" onClick={() => { setSearchFile(null); setFields({ ...fields, searchImage: "" }); }}>Reset to default</button>
          )}
        </div>
        </>)}
        {part === "banner" && (<>
        <p className="admin-section-note">This banner appears at the bottom of every product page, below the product photos.</p>
        <div className="admin-explore-fields">
            <div className="field">
              <label htmlFor="explore-title">Title</label>
              <input id="explore-title" maxLength={60} placeholder="Find your next favourite crumb" value={(fields.exploreTitle ?? "")} onChange={(event) => setFields({ ...fields, exploreTitle: event.target.value })} />
              <small className="admin-editor-count">{(fields.exploreTitle ?? "").length} / 60</small>
            </div>
            <div className="field">
              <label htmlFor="explore-subtext">Subtext</label>
              <textarea id="explore-subtext" className="admin-textarea-lines" style={{ "--lines": 2 } as React.CSSProperties} maxLength={160} placeholder="Fresh batches, baked to order and ready for pickup. Browse every flavour." value={(fields.exploreSubtext ?? "")} onChange={(event) => setFields({ ...fields, exploreSubtext: event.target.value })} />
              <small className="admin-editor-count">{(fields.exploreSubtext ?? "").length} / 160</small>
            </div>
        </div>
        </>)}
      </div>
      <div className="admin-editor-actions">
        <button className={`btn btn-light${status === "Saving..." ? " btn-loading" : ""}`} disabled={status === "Saving..." || !changed}>
          {status === "Saving..." && <span className="btn-spinner" aria-hidden="true" />}
          {status === "Saving..." ? "Saving…" : "Save changes"}
        </button>
        {status && status !== "Saving..." && <span>{status}</span>}
      </div>
    </form>
  );
}


function DeliverySettings({
  begin,
  finish,
  initial,
  onSaved,
}: {
  begin: (message: string) => void;
  finish: (message?: string) => void;
  initial: Record<string, string>;
  onSaved: (enabled: boolean) => void;
}) {
  const pick = (source: Record<string, string>) => {
    const option = deliveryFrom(source);
    return {
      deliveryEnabled: option.enabled ? "true" : "false",
      deliveryFee: option.fee.toFixed(2),
      pickupFee: option.pickupFee ? option.pickupFee.toFixed(2) : "",
      deliveryFreeOver: option.freeOver === null ? "" : option.freeOver.toFixed(2),
      deliveryPostcodes: option.postcodes,
      deliveryRadiusKm: option.radiusKm,
      pickupTitle: initial.pickupTitle ?? "",
      pickupDescription: option.pickupDescription,
      deliveryTitle: initial.deliveryTitle ?? "",
      deliveryDescription: initial.deliveryDescription ?? "",
      deliveryInfo: initial.deliveryInfo ?? "",
    };
  };
  const [fields, setFields] = useState(() => pick(initial));
  const [radius, setRadius] = useState(() => pick(initial).deliveryRadiusKm);
  const [saved, setSaved] = useState(() => JSON.stringify(pick(initial)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const changed = JSON.stringify(fields) !== saved;
  const enabled = fields.deliveryEnabled === "true";
  const plain = (key: "deliveryFee" | "deliveryFreeOver" | "pickupFee", id: string, placeholder: string) => (
    <div className="admin-card-price-input">
      {fields[key] !== "" && <span aria-hidden="true">$</span>}
      <input
        id={id}
        inputMode="decimal"
        maxLength={8}
        placeholder={placeholder}
        value={fields[key]}
        onChange={(event) => {
          const [whole, ...rest] = event.target.value.replace(/[^0-9.]/g, "").split(".");
          setFields({ ...fields, [key]: rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole });
        }}
        onBlur={() => {
          const amount = Number(fields[key]);
          if (fields[key].trim() && Number.isFinite(amount)) setFields({ ...fields, [key]: amount.toFixed(2) });
        }}
      />
    </div>
  );

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    begin("Saving changes…");
    const latest = await fetch("/api/admin/content?module=settings").then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const response = await fetch("/api/admin/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module: "settings", fields: { ...Object.fromEntries(Object.entries(latest?.fields ?? {}).filter(([key]) => key !== "deliveryNote")), ...fields } }),
    });
    setSaving(false);
    if (response.ok) {
      setSaved(JSON.stringify(fields));
      onSaved(enabled);
      finish("Changes successfully saved");
      return;
    }
    finish();
    setError((await response.json().catch(() => null))?.error || "Unable to save");
  }

  return (
    <form className="enquiry-form admin-editor admin-card-settings" onSubmit={save}>
      <div className="admin-editor-fields">
        <label className={`${switchStyles.root} admin-promo-row`} style={{ marginBottom: 24 }}>
          <span>
            <strong>Offer delivery on all products</strong>
            <small>{enabled ? "Customers choose Pickup or Delivery when they add a product to the cart." : "Every order is pickup and customers only choose a pickup window when they add a product to the cart."}</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={enabled}
            onChange={(event) => setFields({ ...fields, deliveryEnabled: event.target.checked ? "true" : "false" })}
          />
          <span className={switchStyles.track} aria-hidden="true" />
        </label>
        <div className={enabled ? undefined : "admin-section-disabled"} inert={!enabled}>
        {(
          <>
            <div className="admin-card-pair admin-card-stack">
              <div className="field admin-card-price">
                <label htmlFor="delivery-fee">Delivery fee (AUD)</label>
                {plain("deliveryFee", "delivery-fee", "Leave blank to set default of $10")}
              </div>
              <div className="field admin-card-price">
                <label htmlFor="delivery-free-over">Free delivery over (AUD)</label>
                {plain("deliveryFreeOver", "delivery-free-over", "Order total, or blank for none")}
              </div>
              <div className="field admin-card-price">
                <label htmlFor="pickup-fee">Pickup fee (AUD)</label>
                {plain("pickupFee", "pickup-fee", "Pickup fee, or blank for free")}
              </div>
            </div>
<div className="admin-card-pair admin-card-stack">
              <div className="field">
                <label htmlFor="opt-pickup-title">Pickup card title</label>
                <input id="opt-pickup-title" placeholder="Leave blank to show Pickup" maxLength={30} value={fields.pickupTitle} onChange={(event) => setFields({ ...fields, pickupTitle: event.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="opt-pickup-desc">Pickup card description</label>
                <input id="opt-pickup-desc" placeholder="Blank shows pickup fee" maxLength={80} value={fields.pickupDescription} onChange={(event) => setFields({ ...fields, pickupDescription: event.target.value })} />
              </div>
            </div>
            <div className="admin-card-pair admin-card-stack">
              <div className="field">
                <label htmlFor="opt-delivery-title">Delivery card title</label>
                <input id="opt-delivery-title" placeholder="Leave blank to show Delivery" maxLength={30} value={fields.deliveryTitle} onChange={(event) => setFields({ ...fields, deliveryTitle: event.target.value })} />
              </div>
              <div className="field">
                <label htmlFor="opt-delivery-desc">Delivery card description</label>
                <input id="opt-delivery-desc" placeholder="Blank shows delivery fee" maxLength={80} value={fields.deliveryDescription} onChange={(event) => setFields({ ...fields, deliveryDescription: event.target.value })} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="opt-delivery-info">Delivery information text (use {"{km}"} for the radius)</label>
              <input id="opt-delivery-info" placeholder={defaultDeliveryInfo} maxLength={200} value={fields.deliveryInfo} onChange={(event) => setFields({ ...fields, deliveryInfo: event.target.value })} />
            </div>
            <div className="admin-card-pair admin-card-stack">
            <div className="field admin-card-price">
              <label htmlFor="delivery-radius">Delivery radius from Melbourne CBD (km)</label>
              <div className="admin-card-price-input"><input id="delivery-radius" inputMode="numeric" maxLength={3} placeholder="Radius in km, or blank for none" value={radius} onChange={(event) => {
                const value = event.target.value.replace(/\D/g, "");
                setRadius(value);
                setFields({ ...fields, deliveryRadiusKm: value, deliveryPostcodes: value ? postcodesWithinKm(Number(value)) : "" });
              }} /></div>
            </div>
            </div>
            <div className="field">
              <label htmlFor="delivery-postcodes">Delivery postcodes</label>
              <textarea id="delivery-postcodes" placeholder="Enter postcodes or ranges, separated by commas (e.g. 3000-3099, 3121)" className="admin-textarea-lines" style={{ "--lines": Math.max(2, Math.ceil(fields.deliveryPostcodes.length / 48)) } as React.CSSProperties} value={fields.deliveryPostcodes} onChange={(event) => { setRadius(""); setFields({ ...fields, deliveryRadiusKm: "", deliveryPostcodes: event.target.value }); }} />
            </div>
            
          </>
        )}
        </div>
      </div>
      <div className="admin-editor-actions">
        <button className={`btn btn-light${saving ? " btn-loading" : ""}`} disabled={saving || !changed}>
          {saving && <span className="btn-spinner" aria-hidden="true" />}
          {saving ? "Saving…" : "Save changes"}
        </button>
        {error && <span>{error}</span>}
      </div>
    </form>
  );
}

function PromoSettings({
  products,
  initial,
  begin,
  finish,
  onSaved,
}: {
  products: Product[];
  initial: Record<string, string>;
  begin: (message: string) => void;
  finish: (message?: string) => void;
  onSaved?: (previous: Record<string, string>, next: Record<string, string>) => void;
}) {
  const pick = (source: Record<string, string>) => ({
    promoEnabled: source.promoEnabled === "true" ? "true" : "false",
    promoProductId: source.promoProductId ?? "",
    promoLabel: source.promoLabel ?? "Limited season",
    promoHeadline: source.promoHeadline ?? "",
    promoBlurb: source.promoBlurb ?? "",
    promoButton: source.promoButton ?? "Order now",
    promoCardLabel: source.promoCardLabel ?? "",
    promoCardDescription: source.promoCardDescription ?? "",
    promoCardPrice: source.promoCardPrice ?? "",
  });
  const [values, setValues] = useState(() => pick(initial));
  const [saved, setSaved] = useState(() => JSON.stringify(pick(initial)));
  const [status, setStatus] = useState("");
  const enabled = values.promoEnabled === "true";
  const changed = JSON.stringify(values) !== saved;
  const set = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setStatus("Saving...");
    begin("Saving promo…");
    const next = { ...values, promoProductId: values.promoProductId || products[0]?.id || "" };
    const current = await fetch("/api/admin/content?module=settings").then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const response = await fetch("/api/admin/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module: "settings", fields: { ...(current?.fields ?? {}), ...next } }),
    });
    if (response.ok) {
      onSaved?.(JSON.parse(saved), next);
      setValues(next);
      setSaved(JSON.stringify(next));
      setStatus("");
      finish("Changes successfully saved");
      return;
    }
    finish();
    setStatus((await response.json().catch(() => null))?.error || "Unable to save");
  }

  return (
    <form className="admin-promo-settings" onSubmit={save}>
      <div className="admin-promo-fields">
        <label className={`${switchStyles.root} admin-promo-row`}>
          <span>
            <strong>Hero a product</strong>
            <small>Appears above all other products on Homepage and Crumbs listing</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={enabled}
            onChange={(event) =>
              setValues((current) => ({ ...current, promoEnabled: event.target.checked ? "true" : "false", promoProductId: current.promoProductId || products[0]?.id || "" }))
            }
          />
          <span className={switchStyles.track} aria-hidden="true" />
        </label>
        {enabled && (
          <>
            <div className="enquiry-form admin-editor">
              <div className="admin-editor-fields">
                <div className="admin-card-pair admin-card-even">
                <div className="field">
                  <label id="promo-product-label">Product</label>
                  <PremiumSelect
                    labelId="promo-product-label"
                    value={values.promoProductId}
                    options={products.map((product) => ({ value: product.id, label: product.name }))}
                    placeholder="Choose a product"
                    onChange={(value) => set("promoProductId", value)}
                  />
                </div>
                <div className="field admin-card-price">
                  <label htmlFor="promo-card-price">Card price (AUD)</label>
                  <div className="admin-card-price-input">
                    {values.promoCardPrice.trim() && <span aria-hidden="true">$</span>}
                    <input
                      id="promo-card-price"
                      inputMode="decimal"
                      maxLength={8}
                      placeholder="Free"
                      value={values.promoCardPrice}
                      onChange={(event) => {
                        const [whole, ...rest] = event.target.value.replace(/[^0-9.]/g, "").split(".");
                        set("promoCardPrice", rest.length ? `${whole}.${rest.join("").slice(0, 2)}` : whole);
                      }}
                      onBlur={() => {
                        const amount = Number(values.promoCardPrice);
                        set("promoCardPrice", Number.isFinite(amount) && values.promoCardPrice.trim() ? amount.toFixed(2) : "");
                      }}
                    />
                  </div>
                </div>
                </div>
                <div className="field">
                  <label htmlFor="promo-label">Label</label>
                  <input id="promo-label" maxLength={40} placeholder="Leave blank to hide the label" value={values.promoLabel} onChange={(event) => set("promoLabel", event.target.value)} />
                  <small className="admin-editor-count">{values.promoLabel.length} / 40</small>
                </div>
                <div className="field">
                  <label htmlFor="promo-headline">Headline</label>
                  <input id="promo-headline" maxLength={60} placeholder="Defaults to the product name" value={values.promoHeadline} onChange={(event) => set("promoHeadline", event.target.value)} />
                  <small className="admin-editor-count">{values.promoHeadline.length} / 60</small>
                </div>
                <div className="field">
                  <label htmlFor="promo-blurb">Short description</label>
                  <textarea id="promo-blurb" className="admin-textarea-lines" style={{ "--lines": 2 } as React.CSSProperties} maxLength={120} placeholder="Leave blank to hide the description" value={values.promoBlurb} onChange={(event) => set("promoBlurb", event.target.value)} />
                  <small className="admin-editor-count">{values.promoBlurb.length} / 120</small>
                </div>
                <div className="field">
                  <label htmlFor="promo-button">Button label</label>
                  <input id="promo-button" maxLength={24} value={values.promoButton} onChange={(event) => set("promoButton", event.target.value)} />
                  <small className="admin-editor-count">{values.promoButton.length} / 24</small>
                </div>
                <div className="field">
                  <label htmlFor="promo-card-label">Card name (hero product only)</label>
                  <input id="promo-card-label" maxLength={60} placeholder="Defaults to Club Crumbie Card" value={values.promoCardLabel} onChange={(event) => set("promoCardLabel", event.target.value)} />
                  <small className="admin-editor-count">{values.promoCardLabel.length} / 60</small>
                </div>
                <div className="field">
                  <label htmlFor="promo-card-description">Card description (hero product only)</label>
                  <textarea id="promo-card-description" className="admin-textarea-lines" style={{ "--lines": 3 } as React.CSSProperties} maxLength={200} placeholder="Defaults to the standard card description" value={values.promoCardDescription} onChange={(event) => set("promoCardDescription", event.target.value)} />
                  <small className="admin-editor-count">{values.promoCardDescription.length} / 200</small>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
      <div className="admin-promo-actions">
        <button className={`btn btn-light${status === "Saving..." ? " btn-loading" : ""}`} disabled={status === "Saving..." || !changed}>
          {status === "Saving..." && <span className="btn-spinner" aria-hidden="true" />}
          {status === "Saving..." ? "Saving…" : "Save changes"}
        </button>
        {status && status !== "Saving..." && <span>{status}</span>}
      </div>
    </form>
  );
}

function LandingHeroSettings({
  products,
  initial,
  begin,
  finish,
  onSaved,
}: {
  products: Product[];
  initial: Record<string, string>;
  begin: (message: string) => void;
  finish: (message?: string) => void;
  onSaved?: (next: Record<string, string>) => void;
}) {
  const pick = (source: Record<string, string>) => ({
    landingProductId: source.landingProductId || (source.promoEnabled === "true" ? source.promoProductId ?? "" : ""),
    promoLanding: source.promoLanding === "false" ? "false" : "true",
    promoPill: source.promoPill ?? "Pickup in Ivanhoe",
    promoLayout: source.promoLayout === "split" || source.promoLayout === "triptych" || source.promoLayout === "countdown" ? source.promoLayout : "collage",
    promoList: source.promoList ?? "",
    heroImage: source.heroImage ?? "",
    countdownEnabled: source.countdownEnabled === "true" ? "true" : "false",
    countdownDate: source.countdownDate ?? "",
    countdownTime: source.countdownTime ?? "09:00",
    countdownLabel: source.countdownLabel ?? "Next collection drops in",
    countdownNextProductId: source.countdownNextProductId ?? "",
  });
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const heroPreview = useMemo(() => (heroFile ? URL.createObjectURL(heroFile) : ""), [heroFile]);
  const [values, setValues] = useState(() => pick(initial));
  const [saved, setSaved] = useState(() => JSON.stringify(pick(initial)));
  const [status, setStatus] = useState("");
  const changed = JSON.stringify(values) !== saved || heroFile !== null;
  const set = (key: keyof typeof values, value: string) => setValues((current) => ({ ...current, [key]: value }));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setStatus("Saving...");
    begin("Saving landing page…");
    const next = { ...values };
    if (heroFile) {
      const upload = new FormData();
      upload.append("files", (await compressReferenceImages([heroFile]))[0]);
      const uploaded = await fetch("/api/admin/gallery", { method: "POST", body: upload });
      const result = await uploaded.json().catch(() => null);
      if (!uploaded.ok || !result?.urls?.[0]) {
        finish();
        setStatus(result?.error || "Unable to upload photo");
        return;
      }
      next.heroImage = result.urls[0];
    }
    const current = await fetch("/api/admin/content?module=settings").then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const response = await fetch("/api/admin/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module: "settings", fields: { ...(current?.fields ?? {}), ...next } }),
    });
    if (response.ok) {
      onSaved?.(next);
      setValues(next);
      setHeroFile(null);
      setSaved(JSON.stringify(next));
      setStatus("");
      finish("Changes successfully saved");
      return;
    }
    finish();
    setStatus((await response.json().catch(() => null))?.error || "Unable to save");
  }

  return (
    <form className="admin-promo-settings" onSubmit={save}>
      <div className="admin-promo-fields">
        <div className="enquiry-form admin-editor">
          <div className="admin-editor-fields">
            <div className="field">
              <label id="landing-product-label">Landing page product</label>
              <PremiumSelect
                labelId="landing-product-label"
                value={values.landingProductId}
                options={products.map((product) => ({ value: product.id, label: product.name }))}
                placeholder="Choose a product"
                onChange={(value) => set("landingProductId", value)}
              />
            </div>
            <p className="admin-field-note">The product needs a photo carousel to appear in the layouts below.</p>
                <div className="admin-promo-group">
                <div className="field">
                  <label id="promo-layout-label">Landing page hero layout</label>
                  <PremiumSelect
                    labelId="promo-layout-label"
                    value={values.promoLanding === "false" ? (values.promoLayout === "countdown" ? "countdown" : "video") : values.promoLayout}
                    options={[
                      { value: "video", label: "Simple logo" },
                      { value: "countdown", label: "Countdown" },
                      { value: "collage", label: "Photo collage" },
                      { value: "split", label: "Split" },
                      { value: "triptych", label: "Centred triptych" },
                    ]}
                    placeholder="Choose a layout"
                    onChange={(layout) => setValues((current) => layout === "video" ? { ...current, promoLanding: "false", promoLayout: "collage" } : layout === "countdown" ? { ...current, promoLanding: "false", promoLayout: "countdown" } : { ...current, promoLanding: "true", promoLayout: layout })}
                  />
                </div>
                {values.promoLanding === "false" && values.promoLayout === "countdown" && (
                <>
                {(
                  <>
                    <div className="field">
                      <label htmlFor="countdown-label">Countdown label</label>
                      <input id="countdown-label" maxLength={60} placeholder="Leave blank to hide the label" value={values.countdownLabel} onChange={(event) => set("countdownLabel", event.target.value)} />
                      <small className="admin-editor-count">{values.countdownLabel.length} / 60</small>
                    </div>
                    <div className="admin-card-pair admin-card-even">
                      <div className="field">
                        <label htmlFor="countdown-date">Next collection release date</label>
                        <DatePicker id="countdown-date" value={values.countdownDate} onChange={(value) => set("countdownDate", value)} />
                      </div>
                      <div className="field">
                        <label htmlFor="countdown-time">Release time (Melbourne)</label>
                        <TimePicker id="countdown-time" label="Release time" value={values.countdownTime} onChange={(value) => set("countdownTime", value)} />
                      </div>
                    </div>
                    <div className="field">
                      <label id="countdown-next-label">Landing page after countdown</label>
                      <PremiumSelect
                        labelId="countdown-next-label"
                        value={values.countdownNextProductId}
                        options={[{ value: "", label: "Stay on the countdown" }, ...products.map((product) => ({ value: product.id, label: product.name }))]}
                        placeholder="Choose a product"
                        onChange={(value) => set("countdownNextProductId", value)}
                      />
                    </div>
                  </>
                )}
                <div className="field admin-gallery-field">
                  <label htmlFor="promo-hero-image">Background image</label>
                  <p>The photo behind the logo on the landing page.</p>
                  <label className="admin-reference-dropzone admin-gallery-dropzone" htmlFor="promo-hero-image" tabIndex={0}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith("image/"));
                      if (file) setHeroFile(file);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        document.getElementById("promo-hero-image")?.click();
                      }
                    }}
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 16V5m0 0L8 9m4-4 4 4M5 15v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3" />
                    </svg>
                    <span>Click to upload a photo</span>
                    <small>or drag and drop · JPG, PNG or WebP</small>
                    <input id="promo-hero-image" type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) setHeroFile(file); event.target.value = ""; }} />
                  </label>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={heroPreview || values.heroImage || "/hero-default.jpg"} alt="Background preview" style={{ width: "100%", maxWidth: 320, aspectRatio: "16 / 9", objectFit: "cover", borderRadius: 12, marginTop: 12 }} />
                  {(values.heroImage || heroFile) && (
                    <button type="button" className="text-button" onClick={() => { setHeroFile(null); set("heroImage", ""); }}>Reset to default</button>
                  )}
                </div>
                </>
                )}
                {values.promoLanding === "true" && (
                  <>
                {values.promoLayout === "triptych" && (
                <div className="field">
                  <label htmlFor="promo-pill">Photo label</label>
                  <input id="promo-pill" maxLength={40} placeholder="Leave blank to hide the label" value={values.promoPill} onChange={(event) => set("promoPill", event.target.value)} />
                  <small className="admin-editor-count">{values.promoPill.length} / 40</small>
                </div>
                )}
                {values.promoLayout !== "split" && (
                <div className="field">
                  <label htmlFor="promo-list">List items (one per line)</label>
                  <textarea id="promo-list" className="admin-textarea-lines" style={{ "--lines": 5 } as React.CSSProperties} maxLength={600} placeholder="Leave blank to list the product's box sizes" value={values.promoList} onChange={(event) => set("promoList", event.target.value)} />
                  <small className="admin-editor-count">{values.promoList.length} / 600</small>
                </div>
                )}
                  </>
                )}
                </div>
          </div>
        </div>
      </div>
      <div className="admin-promo-actions">
        <button className={`btn btn-light${status === "Saving..." ? " btn-loading" : ""}`} disabled={status === "Saving..." || !changed}>
          {status === "Saving..." && <span className="btn-spinner" aria-hidden="true" />}
          {status === "Saving..." ? "Saving…" : "Save changes"}
        </button>
        {status && status !== "Saving..." && <span>{status}</span>}
      </div>
    </form>
  );
}

function MessageSettings({
  begin,
  finish,
  initial,
}: {
  begin: (message: string) => void;
  finish: (message?: string) => void;
  initial: Record<string, string>;
}) {
  const pick = (source: Record<string, string>) => ({
    deliverableMessage: source.deliverableMessage ?? "",
    undeliverableMessage: source.undeliverableMessage ?? "",
    addressErrorMessage: source.addressErrorMessage ?? "",
    unavailableMessage: source.unavailableMessage ?? "",
  });
  const [fields, setFields] = useState(() => pick(initial));
  const [saved, setSaved] = useState(() => JSON.stringify(pick(initial)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const changed = JSON.stringify(fields) !== saved;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    begin("Saving changes…");
    const latest = await fetch("/api/admin/content?module=settings").then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const response = await fetch("/api/admin/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ module: "settings", fields: { ...(latest?.fields ?? {}), ...fields } }),
    });
    setSaving(false);
    if (response.ok) {
      setSaved(JSON.stringify(fields));
      finish("Changes successfully saved");
      return;
    }
    finish();
    setError((await response.json().catch(() => null))?.error || "Unable to save");
  }

  return (
    <form className="enquiry-form admin-editor admin-card-settings" onSubmit={save}>
      <div className="admin-editor-fields">
        <div className="field">
          <label htmlFor="deliverable-message">Postcode is deliverable (use {"{postcode}"} to show it)</label>
          <textarea id="deliverable-message" className="admin-textarea-lines" style={{ "--lines": 2 } as React.CSSProperties} maxLength={200} placeholder={defaultDeliverableMessage} value={fields.deliverableMessage ?? ""} onChange={(event) => setFields({ ...fields, deliverableMessage: event.target.value })} />
          <small className="admin-editor-count">{(fields.deliverableMessage ?? "").length} / 200</small>
        </div>
        <div className="field">
          <label htmlFor="undeliverable-message">Postcode is outside the delivery area</label>
          <textarea id="undeliverable-message" className="admin-textarea-lines" style={{ "--lines": 2 } as React.CSSProperties} maxLength={200} placeholder={defaultUndeliverableMessage} value={fields.undeliverableMessage ?? ""} onChange={(event) => setFields({ ...fields, undeliverableMessage: event.target.value })} />
          <small className="admin-editor-count">{(fields.undeliverableMessage ?? "").length} / 200</small>
        </div>
        <div className="field">
          <label htmlFor="address-error-message">Delivery address not found</label>
          <textarea id="address-error-message" className="admin-textarea-lines" style={{ "--lines": 2 } as React.CSSProperties} maxLength={200} placeholder={defaultAddressErrorMessage} value={fields.addressErrorMessage ?? ""} onChange={(event) => setFields({ ...fields, addressErrorMessage: event.target.value })} />
          <small className="admin-editor-count">{(fields.addressErrorMessage ?? "").length} / 200</small>
        </div>
        <div className="field">
          <label htmlFor="unavailable-message">Product or box size unavailable</label>
          <textarea id="unavailable-message" className="admin-textarea-lines" style={{ "--lines": 2 } as React.CSSProperties} maxLength={200} placeholder={defaultUnavailableMessage} value={fields.unavailableMessage ?? ""} onChange={(event) => setFields({ ...fields, unavailableMessage: event.target.value })} />
          <small className="admin-editor-count">{(fields.unavailableMessage ?? "").length} / 200</small>
        </div>
      </div>
      <div className="admin-editor-actions">
        <button className={`btn btn-light${saving ? " btn-loading" : ""}`} disabled={saving || !changed}>
          {saving && <span className="btn-spinner" aria-hidden="true" />}
          {saving ? "Saving…" : "Save changes"}
        </button>
        {error && <span>{error}</span>}
      </div>
    </form>
  );
}

function AdminAccordion({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="admin-accordion">
      <summary>
        <h3>{title}</h3>
        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="m4 6 4 4 4-4" /></svg>
      </summary>
      <div className="admin-accordion-body">{children}</div>
    </details>
  );
}

function ContentEditor({
  moduleName,
  begin,
  finish,
}: {
  moduleName: string;
  begin: (message: string) => void;
  finish: (message?: string) => void;
}) {
  const [content, setContent] = useState<Content>(() => emptyContent(moduleName));
  const [savedContent, setSavedContent] = useState(() => JSON.stringify(emptyContent(moduleName)));
  const [contentStatus, setContentStatus] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [draggedEnquiryType, setDraggedEnquiryType] = useState<number | null>(null);
  const contentChanged = JSON.stringify(content) !== savedContent;

  useEffect(() => {
    let active = true;
    void (async () => {
      const response = await fetch(`/api/admin/content?module=${encodeURIComponent(moduleName)}`).catch(() => null);
      const saved = response?.ok ? await response.json().catch(() => null) : null;
      if (!active) return;
      const next: Content = saved?.fields
        ? {
            ...mergeContent(moduleName, saved.fields),
            sections: saved.sections || emptyContent(moduleName).sections,
            removedFields: saved.removedFields || emptyContent(moduleName).removedFields,
          }
        : emptyContent(moduleName);
      setContent(next);
      setSavedContent(JSON.stringify(next));
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [moduleName]);

  const optionalPolicySections = [
    { number: 5, headingKey: "allergenHeading", bodyKey: "allergenCopy" },
    { number: 6, headingKey: "enquiryHeading", bodyKey: "enquiryCopy" },
  ] as const;

  function renderContentField(field: ContentField) {
    const value = content.fields[field.key] || "";
    const id = `content-${moduleName.replace(/\s+/g, "-")}-${field.key}`;
    const update = (next: string) => setContent({ ...content, fields: { ...content.fields, [field.key]: next } });

    return (
      <div className="field" key={field.key}>
        <label htmlFor={id}>{field.label}</label>
        {field.multiline ? (
          <textarea
            id={id}
            rows={field.rows ?? 5}
            className={field.rows ? "admin-textarea-compact" : "admin-textarea-lines"}
            style={field.rows ? undefined : ({ "--lines": Math.min(8, Math.max(2, Math.ceil(field.maxLength / 90))) } as React.CSSProperties)}
            maxLength={field.maxLength}
            value={value}
            onChange={(event) => update(event.target.value)}
          />
        ) : (
          <input id={id} maxLength={field.maxLength} value={value} onChange={(event) => update(event.target.value)} />
        )}
        <small className="admin-editor-count">{`${value.length} / ${field.maxLength}`}</small>
      </div>
    );
  }

  async function saveContent(event: React.FormEvent) {
    event.preventDefault();
    const contentModule = contentModules[moduleName];
    if (
      contentModule.fields.some((field) => (content.fields[field.key] || "").length > field.maxLength) ||
      (moduleName === "faqs" && (content.sections || []).some((section) => section.body.length > policyBodyMaxChars))
    ) {
      setContentStatus("Shorten the highlighted field before saving");
      return;
    }
    setContentStatus("Saving...");
    begin("Saving changes…");
    const response = await fetch("/api/admin/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        module: moduleName,
        fields: content.fields,
        sections: content.sections,
        removedFields: content.removedFields,
      }),
    });
    if (response.ok) {
      setSavedContent(JSON.stringify(content));
      setContentStatus("");
      finish("Changes successfully saved");
      return;
    }
    finish();
    setContentStatus((await response.json().catch(() => null))?.error || "Unable to save");
  }

  if (!loaded) return <p className="admin-sync-note">Loading…</p>;

  return (
          <form className="enquiry-form admin-editor" onSubmit={saveContent}>
            <div className="admin-editor-fields">
              {contentModules[moduleName].fields
                .filter(
                  (field) =>
                    !(moduleName === "faqs" &&
                    (content.removedFields || []).includes(field.key)) &&
                    !(moduleName === "faqs" &&
                    optionalPolicySections.some(
                      (section) =>
                        field.key === section.headingKey ||
                        field.key === section.bodyKey,
                    )),
                )
                .map(renderContentField)}
              {moduleName === "contact us" && (() => {
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
              {moduleName === "faqs" &&
                optionalPolicySections
                  .filter(
                    (section) =>
                      !(content.removedFields || []).includes(section.headingKey) &&
                      !(content.removedFields || []).includes(section.bodyKey),
                  )
                  .map((section) => {
                    const headingField = contentModules.faqs.fields.find(
                      (field) => field.key === section.headingKey,
                    );
                    const bodyField = contentModules.faqs.fields.find(
                      (field) => field.key === section.bodyKey,
                    );
                    if (!headingField || !bodyField) return null;
                    return (
                      <section
                        className="admin-policy-editor-section"
                        key={`policy-section-${section.number}`}
                      >
                        <div className="admin-policy-editor-section-heading">
                          <h3>Question {section.number}</h3>
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
                            Remove question
                          </button>
                        </div>
                        {renderContentField(headingField)}
                        {renderContentField(bodyField)}
                      </section>
                    );
                  })}
              {moduleName === "faqs" && (
                <div className="admin-modal admin-policy-sections">
                  <div className="admin-policy-sections-heading">
                    <div className="admin-modal-header">
                      <h2>Add question</h2>
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
                      <h3>Question {index + 7}</h3>
                      <div className="field">
                        <label htmlFor={`policy-section-heading-${index}`}>
                          Question
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
                          Answer
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
                      Add another question
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
              {moduleName === "faqs" && (
                <>
                  <input id="policy-modal-toggle" type="checkbox" hidden />
                  <label className="btn btn-dark admin-policy-open" htmlFor="policy-modal-toggle">
                    Add question
                  </label>
                </>
              )}
            </div>
          </form>
  );
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
  const [dismissedEnquiryIds, setDismissedEnquiryIds] = useState<Set<string> | null>(readDismissedEnquiryIds);
  const knownEnquiryIds = useRef<Set<string> | null>(null);
  const pageContentRef = useRef<HTMLDivElement>(null);
  const [accordionsAllOpen, setAccordionsAllOpen] = useState(false);
  const syncAccordionsOpen = () => {
    const items = Array.from(pageContentRef.current?.querySelectorAll<HTMLDetailsElement>("details.admin-accordion") || []);
    setAccordionsAllOpen(items.length > 0 && items.every((d) => d.open));
  };
  const toggleAccordions = () => {
    const items = Array.from(pageContentRef.current?.querySelectorAll<HTMLDetailsElement>("details.admin-accordion") || []);
    items.forEach((d, i) => {
      d.style.setProperty("--accordion-delay", `${i * 55}ms`);
      d.open = !accordionsAllOpen;
    });
    window.setTimeout(() => items.forEach((d) => d.style.removeProperty("--accordion-delay")), items.length * 55 + 600);
    syncAccordionsOpen();
  };
  useEffect(() => {
    const node = pageContentRef.current;
    if (!node) return;
    node.addEventListener("toggle", syncAccordionsOpen, true);
    return () => node.removeEventListener("toggle", syncAccordionsOpen, true);
  }, [tab]);
  const tabRef = useRef(tab);
  const [adminNoticeLeaving, setAdminNoticeLeaving] = useState(false);
  const [adminBusyMessage, setAdminBusyMessage] = useState("");
  const [pickupDatePendingRemoval, setPickupDatePendingRemoval] =
    useState<PickupDate | null>(null);
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);
  const [blockedPickupDateRemoval, setBlockedPickupDateRemoval] = useState<{
    pickupDate: PickupDate;
    orderCount: number;
  } | null>(null);
  const [removingPickupDateId, setRemovingPickupDateId] = useState("");
  const [replyingEnquiry, setReplyingEnquiry] = useState<Enquiry | null>(null);
  const [replySubject, setReplySubject] = useState(DEFAULT_REPLY_SUBJECT);
  const [replyMessage, setReplyMessage] = useState("");
  const replyRequest = useRef<{ body: string; id: string } | null>(null);
  const [replyError, setReplyError] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [updatingEnquiryId, setUpdatingEnquiryId] = useState<string | null>(null);
  const [enquiryMenuId, setEnquiryMenuId] = useState<string | null>(null);
  const [enquiryPendingDeletion, setEnquiryPendingDeletion] = useState<Enquiry | null>(null);
  const [enquiryTypeFilter, setEnquiryTypeFilter] = useState("all");
  const [enquiryStatusFilter, setEnquiryStatusFilter] = useState("all");
  const [enquirySort, setEnquirySort] = useState("newest");
  const [deletingEnquiryId, setDeletingEnquiryId] = useState<string | null>(null);
  const [pickupFilter, setPickupFilter] = useState<PickupFilter>("all");
  const [managedDeliveryDates, setManagedDeliveryDates] = useState<PickupDate[]>([]);
  const deliveryTab = tab === "delivery windows";
  const dateNoun = deliveryTab ? "delivery" : "pickup";
  const managedDates = deliveryTab ? managedDeliveryDates : managedPickupDates;
  const setManagedDates = deliveryTab ? setManagedDeliveryDates : setManagedPickupDates;
  const [managedProducts, setManagedProducts] = useState<Product[]>(products);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [cardSettings, setCardSettings] = useState<Record<string, string> | null>(null);
  const deliveryOn = cardSettings ? deliveryFrom(cardSettings).enabled : false;
  const [productStatus, setProductStatus] = useState("");
  const [productFieldErrors, setProductFieldErrors] = useState<
    Record<string, string>
  >({});
  const [newProduct, setNewProduct] = useState({
    name: "",
    description: "",
    ingredients: defaultProductIngredients,
    allergens: defaultProductAllergens,
    price4: "",
    price6: "",
    price12: "",
  });
  const [productImages, setProductImages] = useState<string[]>([]);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [heroMode, setHeroMode] = useState<"cookie" | "carousel">("cookie");
  const [heroImages, setHeroImages] = useState<string[]>([]);
  const [heroFiles, setHeroFiles] = useState<File[]>([]);
  const [heroDragActive, setHeroDragActive] = useState(false);
  const [cardImage, setCardImage] = useState("");
  const [cardFile, setCardFile] = useState<File | null>(null);
  const [cardDragActive, setCardDragActive] = useState(false);
  const addCardFile = (picked: File[]) => {
    const file = picked.find((item) => item.type.startsWith("image/"));
    if (file) setCardFile(file);
  };
  const addHeroFiles = (picked: File[]) =>
    setHeroFiles((current) => [...current, ...picked.filter((file) => file.type.startsWith("image/"))]);
  const [referenceImageFiles, setReferenceImageFiles] = useState<File[]>([]);
  const [referenceDropActive, setReferenceDropActive] = useState(false);
  const [imageDirection, setImageDirection] = useState("");
  const [generatedImageCount, setGeneratedImageCount] = useState<number>(RECOMMENDED_IMAGE_COUNT);
  const [generationStatus, setGenerationStatus] = useState("");
  const [generationProgress, setGenerationProgress] = useState({ done: 0, total: 0 });
  const [descriptionStatus, setDescriptionStatus] = useState("");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [emailTemplateKey, setEmailTemplateKey] = useState<string | null>(null);
  const [viewingEnquiryId, setViewingEnquiryId] = useState<string | null>(null);
  const [savedProduct, setSavedProduct] = useState<string | null>(null);
  const contentChanged = JSON.stringify(content) !== savedContent;
  const productChanged =
    !editingProductId || JSON.stringify({ newProduct, productImages, galleryImages, galleryFiles: galleryFiles.map((file) => file.name + file.size), heroMode, heroImages, heroFiles: heroFiles.map((file) => file.name + file.size), cardImage, cardFile: cardFile ? cardFile.name + cardFile.size : "" }) !== savedProduct;

  function loadContent(next: Content) {
    setContent(next);
    setSavedContent(JSON.stringify(next));
  }

  function receiveDashboard(next: Data) {
    setData(next);
    const enquiries = ((next as { enquiries?: Enquiry[] }).enquiries ?? []).filter((enquiry) => enquiry.id);
    const known = knownEnquiryIds.current;
    knownEnquiryIds.current = new Set([...(known ?? []), ...enquiries.map((enquiry) => enquiry.id as string)]);
    if (!known) return;
    const fresh = enquiries.filter((enquiry) => !known.has(enquiry.id as string));
    if (!fresh.length) return;
    const latest = fresh[0];
    if (document.hidden && "Notification" in window && Notification.permission === "granted") {
      try {
        new Notification("New Club Crumbie enquiry", {
          body: `${latest.name || "A customer"}: ${(latest.request || "").slice(0, 120)}`,
          icon: "/favicon.ico",
        });
      } catch {}
    }
  }

  async function load() {
    const response = await fetch("/api/admin/dashboard");
    if (response.ok) {
      receiveDashboard(await response.json());
      setDashboardError("");
      if (!cardSettings) {
        const settings = await fetch("/api/admin/content?module=settings").catch(() => null);
        setCardSettings(normalizeCardSettings(settings?.ok ? await settings.json().catch(() => null) : null));
      }
    } else {
      setDashboardError("Your admin session has expired. Sign in again.");
    }
  }

  async function fetchProductsWithRetry() {
    let response = await fetch("/api/admin/products", { cache: "no-store" });
    for (let attempt = 0; attempt < 3 && !response.ok && response.status !== 401; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
      response = await fetch("/api/admin/products", { cache: "no-store" });
    }
    return response;
  }

  async function loadAdminResources() {
    const [
      dashboardResult,
      configResult,
      pickupDatesResult,
      deliveryDatesResult,
      productsResult,
      cardSettingsResult,
    ] = await Promise.allSettled([
      fetch("/api/admin/dashboard"),
      fetch("/api/admin/config"),
      fetch("/api/admin/pickup-dates"),
      fetch("/api/admin/delivery-dates"),
      fetchProductsWithRetry(),
      fetch("/api/admin/content?module=settings"),
    ]);

    if (
      dashboardResult.status === "fulfilled" &&
      dashboardResult.value.ok
    ) {
      receiveDashboard(await dashboardResult.value.json());
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
    if (deliveryDatesResult.status === "fulfilled" && deliveryDatesResult.value.ok) {
      setManagedDeliveryDates(await deliveryDatesResult.value.json());
    }
    if (productsResult.status === "fulfilled" && productsResult.value.ok) {
      setManagedProducts(await productsResult.value.json());
    }
    setCardSettings(
      normalizeCardSettings(
        cardSettingsResult.status === "fulfilled" && cardSettingsResult.value.ok
          ? await cardSettingsResult.value.json().catch(() => null)
          : null,
      ),
    );
    setProductsLoaded(true);
    setCheckingSession(false);
    const lastTab = localStorage.getItem(LAST_TAB_KEY);
    if (lastTab && lastTab !== tabRef.current && adminTabs.includes(lastTab)) void selectTab(lastTab);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAdminResources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasDashboard = data !== null;

  useEffect(() => {
    if (!hasDashboard) return;
    if ("Notification" in window && Notification.permission === "default") {
      try {
        void Promise.resolve(Notification.requestPermission()).catch(() => {});
      } catch {}
    }
    async function poll() {
      const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
      if (response.ok) receiveDashboard(await response.json());
    }
    const interval = window.setInterval(() => void poll(), 20000);
    function pollOnFocus() {
      if (!document.hidden) void poll();
    }
    document.addEventListener("visibilitychange", pollOnFocus);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", pollOnFocus);
    };
     
  }, [hasDashboard]);

  const unreadEnquiries = ((data?.enquiries ?? []) as Enquiry[]).filter(isUnread);
  const unreadCount = unreadEnquiries.length;
  const alertEnquiries = dismissedEnquiryIds
    ? unreadEnquiries.filter((enquiry) => enquiry.id && !dismissedEnquiryIds.has(enquiry.id))
    : [];

  function dismissEnquiryAlert() {
    const next = new Set(dismissedEnquiryIds ?? []);
    alertEnquiries.forEach((enquiry) => next.add(enquiry.id as string));
    setDismissedEnquiryIds(next);
    try {
      localStorage.setItem(DISMISSED_ENQUIRY_ALERTS_KEY, JSON.stringify([...next]));
    } catch {}
  }

  useEffect(() => {
    const base = document.title.replace(/^\(\d+\) /, "");
    document.title = unreadCount ? `(${unreadCount}) ${base}` : base;
  }, [unreadCount]);

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

  function openEnquiryReply(enquiry: Enquiry) {
    replyRequest.current = null;
    setReplyingEnquiry(enquiry);
    setReplySubject(enquiry.gmailSubject || DEFAULT_REPLY_SUBJECT);
    setReplyMessage(`Hi ${enquiry.name?.split(" ")[0] || "there"},\n\n\n\nThanks,\nClub Crumbie`);
    setReplyError("");
  }

  function closeEnquiryReply() {
    if (sendingReply) return;
    setReplyingEnquiry(null);
    setReplyError("");
  }

  async function sendEnquiryReply(event: React.FormEvent) {
    event.preventDefault();
    if (!replyingEnquiry?.id) return;
    if (!replySubject.trim() || !replyMessage.trim()) {
      setReplyError("Add a subject and message.");
      return;
    }
    setSendingReply(true);
    setReplyError("");
    const replyBody = JSON.stringify({ id: replyingEnquiry.id, subject: replySubject, message: replyMessage });
    if (replyRequest.current?.body !== replyBody) replyRequest.current = { body: replyBody, id: crypto.randomUUID() };
    const response = await fetch("/api/admin/enquiries/reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId: replyRequest.current.id,
        id: replyingEnquiry.id,
        subject: replySubject,
        message: replyMessage,
      }),
    }).catch(() => null);
    setSendingReply(false);
    if (!response?.ok) {
      setReplyError(
        (await response?.json().catch(() => null))?.error ||
          "Unable to send reply. Please try again.",
      );
      return;
    }
    const updated = (await response.json()) as Enquiry;
    setData((current) =>
      current
        ? {
            ...current,
            enquiries: (current.enquiries as Enquiry[]).map((enquiry) =>
              enquiry.id === updated.id ? updated : enquiry,
            ),
          }
        : current,
    );
    setReplyingEnquiry(null);
    finishAdminAction(`Reply sent to ${updated.email}`);
  }

  function replaceEnquiry(updated: Enquiry) {
    setData((current) =>
      current
        ? {
            ...current,
            enquiries: (current.enquiries as Enquiry[]).map((item) =>
              item.id === updated.id ? updated : item,
            ),
          }
        : current,
    );
  }

  function openEnquiry(enquiry: Enquiry) {
    if (!enquiry.id) return;
    setViewingEnquiryId(enquiry.id);
    if (enquiry.readAt) return;
    replaceEnquiry({ ...enquiry, readAt: new Date().toISOString() });
    void fetch("/api/admin/enquiries/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: enquiry.id }),
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((updated: Enquiry | null) => updated && replaceEnquiry(updated))
      .catch(() => {});
  }

  async function deleteEnquiry() {
    const enquiry = enquiryPendingDeletion;
    if (!enquiry?.id || deletingEnquiryId) return;
    setDeletingEnquiryId(enquiry.id);
    const response = await fetch("/api/admin/enquiries/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: enquiry.id }),
    }).catch(() => null);
    setDeletingEnquiryId(null);
    setEnquiryPendingDeletion(null);
    if (!response?.ok) {
      finishAdminAction("Unable to delete enquiry. Please try again.");
      return;
    }
    setData((current) =>
      current
        ? {
            ...current,
            enquiries: (current.enquiries as Enquiry[]).filter((item) => item.id !== enquiry.id),
          }
        : current,
    );
    if (viewingEnquiryId === enquiry.id) setViewingEnquiryId(null);
    finishAdminAction("Enquiry deleted");
  }

  useEffect(() => {
    if (!enquiryMenuId) return;
    function closeMenu(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setEnquiryMenuId(null);
        return;
      }
      if (!(event.target as Element).closest?.(".admin-kebab")) setEnquiryMenuId(null);
    }
    document.addEventListener("mousedown", closeMenu);
    document.addEventListener("keydown", closeMenu);
    return () => {
      document.removeEventListener("mousedown", closeMenu);
      document.removeEventListener("keydown", closeMenu);
    };
  }, [enquiryMenuId]);

  async function setEnquiryStatus(enquiry: Enquiry, status: "replied" | "pending" | "new") {
    if (!enquiry.id || updatingEnquiryId) return;
    setUpdatingEnquiryId(enquiry.id);
    const response = await fetch("/api/admin/enquiries/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: enquiry.id, status }),
    }).catch(() => null);
    setUpdatingEnquiryId(null);
    if (!response?.ok) {
      finishAdminAction("Unable to update enquiry. Please try again.");
      return;
    }
    const updated = (await response.json()) as Enquiry;
    setData((current) =>
      current
        ? {
            ...current,
            enquiries: (current.enquiries as Enquiry[]).map((item) =>
              item.id === updated.id ? updated : item,
            ),
          }
        : current,
    );
    finishAdminAction(`Marked as ${status}`);
  }

  useEffect(() => {
    if (!replyingEnquiry) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !sendingReply) setReplyingEnquiry(null);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [replyingEnquiry, sendingReply]);

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
      await loadAdminResources();
    } catch {
      setError("Couldn't sign in. Check your connection and try again.");
    } finally {
      setSigningIn(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    localStorage.removeItem(LAST_TAB_KEY);
    setTab("orders");
    tabRef.current = "orders";
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
    if (!newPickupDate.trim()) fieldErrors.date = `Choose a ${dateNoun} window.`;
    if (!TIME_PATTERN.test(newPickupStart))
      fieldErrors.start = "Enter a valid start time.";
    if (!TIME_PATTERN.test(newPickupEnd))
      fieldErrors.end = "Enter a valid end time.";
    else if (!fieldErrors.start && newPickupEnd <= newPickupStart)
      fieldErrors.end = "End time must be after the start time.";
    setPickupFieldErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;
    setPickupDateStatus("Saving...");
    beginAdminAction(`Adding ${dateNoun} window…`);
    const response = await fetch(`/api/admin/${dateNoun}-dates`, {
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
        `Unable to save ${dateNoun} window`;
      setPickupDateStatus("");
      setPickupFieldErrors({ date: message });
      return;
    }
    const savedDate = await response.json();
    setManagedDates((current) =>
      [...current.filter((date) => date.id !== savedDate.id), savedDate].sort(
        (left, right) => left.date.localeCompare(right.date),
      ),
    );
    resetPickupForm();
    finishAdminAction(`${deliveryTab ? "Delivery" : "Pickup"} window successfully added`);
    const pickupModalToggle = document.getElementById("pickup-modal-toggle");
    if (pickupModalToggle instanceof HTMLInputElement) {
      pickupModalToggle.checked = false;
    }
  }

  async function removePickupDate(target?: PickupDate) {
    const pending = target || pickupDatePendingRemoval;
    if (!pending) return;
    const { id } = pending;
    setRemovingPickupDateId(id);
    setPickupDateStatus("Removing...");
    beginAdminAction(`Removing ${dateNoun} window…`);
    const response = await fetch(
      `/api/admin/${dateNoun}-dates?id=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    if (!response.ok) {
      setRemovingPickupDateId("");
      finishAdminAction();
      setPickupDateStatus(
        (await response.json().catch(() => null))?.error ||
          `Unable to remove ${dateNoun} window`,
      );
      return;
    }
    setManagedDates((current) =>
      current.filter((date) => date.id !== id),
    );
    setRemovingPickupDateId("");
    setPickupDatePendingRemoval(null);
    setPickupDateStatus("");
    finishAdminAction(`${deliveryTab ? "Delivery" : "Pickup"} window successfully removed`);
  }

  function orderCountForPickupDate(pickupDate: PickupDate) {
    const orders = (data?.orders || []) as Order[];
    if (deliveryTab) return orders.filter((order) => order.deliverySlot?.date === pickupDate.date).length;
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
    // A box size with no price isn't offered on the storefront.
    const hasPrice = (value: string) => value.trim() !== "" && Number(value) > 0;
    if (!hasPrice(newProduct.price4) && !hasPrice(newProduct.price6) && !hasPrice(newProduct.price12))
      fieldErrors.price4 = "Enter a price for at least one box size.";
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
      galleryImages,
      heroMode: heroMode === "carousel" && (heroImages.length > 0 || heroFiles.length > 0) ? "carousel" : undefined,
      heroImages,
      cardImage: cardImage || undefined,
      variants: [
        ...(hasPrice(newProduct.price4)
          ? [{ id: `${slug}-4`, label: "Box of 4", quantity: 4, price: Number(newProduct.price4) }]
          : []),
        ...(hasPrice(newProduct.price6)
          ? [{ id: `${slug}-6`, label: "Box of 6", quantity: 6, price: Number(newProduct.price6) }]
          : []),
        ...(hasPrice(newProduct.price12)
          ? [{ id: `${slug}-12`, label: "Box of 12", quantity: 12, price: Number(newProduct.price12) }]
          : []),
      ],
    };
    formData.set("product", JSON.stringify(product));
    for (const file of await compressReferenceImages(galleryFiles)) formData.append("galleryFiles", file);
    for (const file of await compressReferenceImages(heroFiles)) formData.append("heroFiles", file);
    if (cardFile) formData.append("cardFile", (await compressReferenceImages([cardFile]))[0]);
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
      price4: "",
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
      price4: formatPriceInput(String(product.variants.find((variant) => variant.quantity === 4)?.price || "")),
      price6: formatPriceInput(String(product.variants.find((variant) => variant.quantity === 6)?.price || "")),
      price12: formatPriceInput(String(product.variants.find((variant) => variant.quantity === 12)?.price || "")),
    };
    setEditingProductId(product.id);
    setProductFieldErrors({});
    setNewProduct(productForm);
    setProductImages(product.images);
    setGalleryImages(product.galleryImages || []);
    setGalleryFiles([]);
    setHeroMode(product.heroMode === "carousel" ? "carousel" : "cookie");
    setHeroImages(product.heroImages || []);
    setHeroFiles([]);
    setCardImage(product.cardImage || "");
    setCardFile(null);
    setSavedProduct(JSON.stringify({ newProduct: productForm, productImages: product.images, galleryImages: product.galleryImages || [], galleryFiles: [], heroMode: product.heroMode === "carousel" ? "carousel" : "cookie", heroImages: product.heroImages || [], heroFiles: [], cardImage: product.cardImage || "", cardFile: "" }));
    setReferenceImageFiles([]);
    setImageDirection("");
    setGenerationStatus("");
    (document.getElementById("product-modal-toggle") as HTMLInputElement).checked = true;
  }

  function startNewProduct() {
    setEditingProductId(null);
    setProductFieldErrors({});
    setNewProduct({ name: "", description: "", ingredients: defaultProductIngredients, allergens: defaultProductAllergens, price4: "", price6: "", price12: "" });
    setProductImages([]);
    setGalleryImages([]);
    setGalleryFiles([]);
    setHeroMode("cookie");
    setHeroImages([]);
    setHeroFiles([]);
    setCardImage("");
    setCardFile(null);
    setReferenceImageFiles([]);
    setImageDirection("");
    setGenerationStatus("");
  }

  const heroProductId = cardSettings?.promoEnabled === "true" ? cardSettings.promoProductId : "";
  const orderedProducts = managedProducts.some((product) => product.id === heroProductId)
    ? [...managedProducts.filter((product) => product.id === heroProductId), ...managedProducts.filter((product) => product.id !== heroProductId)]
    : managedProducts;

  const [draggedProduct, setDraggedProduct] = useState<string | null>(null);
  const orderedProductsRef = useRef(orderedProducts);
  orderedProductsRef.current = orderedProducts;

  const touchDragRef = useRef(false);

  function moveProduct(id: string, targetId: string) {
    const list = [...orderedProducts];
    const from = list.findIndex((product) => product.id === id);
    const to = list.findIndex((product) => product.id === targetId);
    if (from < 0 || to < 0 || from === to || list[to].id === heroProductId || id === heroProductId) return;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    setManagedProducts(list);
  }

  async function saveProductOrder() {
    const response = await fetch("/api/admin/products", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: orderedProductsRef.current.map((product) => product.id) }),
    });
    if (!response.ok) setProductStatus((await response.json().catch(() => null))?.error || "Unable to save order");
  }

  function handlePromoSaved(previous: Record<string, string>, next: Record<string, string>) {
    setCardSettings((current) => (current ? { ...current, ...next } : current));
    const wasHero = previous.promoEnabled === "true" ? previous.promoProductId : "";
    if (!wasHero || next.promoEnabled === "true") return;
    const list = orderedProductsRef.current;
    const former = list.find((product) => product.id === wasHero);
    if (!former) return;
    const reordered = [...list.filter((product) => product.id !== wasHero), former];
    setManagedProducts(reordered);
    fetch("/api/admin/products", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: reordered.map((product) => product.id) }),
    });
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

  function adjustProductPrice(field: "price4" | "price6" | "price12", amount: number) {
    const current = Number(newProduct[field]) || 0;
    setNewProduct({
      ...newProduct,
      [field]: Math.max(0, current + amount).toFixed(2),
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
      const references = await compressReferenceImages(referenceImageFiles);
      // Request frames individually so a complete rotation can exceed one
      // hosting request's duration without losing the generation job.
      const framePlan = ROTATION_FRAME_PLANS[generatedImageCount] ?? ROTATION_FRAME_PLANS[RECOMMENDED_IMAGE_COUNT];
      setGenerationProgress({ done: 0, total: framePlan.length });
      for (const [step, frameIndex] of framePlan.entries()) {
        setGenerationStatus(`Generating image ${step + 1} of ${framePlan.length} with OpenAI...`);
        const formData = new FormData();
        formData.set("name", newProduct.name.trim());
        formData.set("direction", imageDirection.trim());
        formData.set("count", "1");
        formData.set("frameIndex", String(frameIndex));
        formData.set("previousImages", JSON.stringify(images));
        references.forEach((file) => formData.append("references", file));
        // Mobile browsers can drop a long-running request ("Load failed"); retry the frame.
        let response: Response | undefined;
        for (let attempt = 0; attempt < 3 && !response; attempt++) {
          try {
            response = await fetch("/api/admin/product-images/generate", { method: "POST", body: formData });
            if (response.status >= 500 && attempt < 2) {
              response = undefined;
              setGenerationStatus(`Connection lost. Retrying image ${step + 1} of ${framePlan.length}...`);
            }
          } catch (error) {
            if (attempt === 2) throw error;
            setGenerationStatus(`Connection lost. Retrying image ${step + 1} of ${framePlan.length}...`);
          }
        }
        if (!response) throw new Error("Unable to generate an image.");
        const result = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(result?.images)) {
          throw new Error(
            result?.error ||
              (response.status === 413
                ? "Reference photos are too large. Try fewer or smaller photos."
                : "Unable to generate an image."),
          );
        }
        images.push(...result.images);
        setGenerationProgress({ done: step + 1, total: framePlan.length });
      }
      setProductImages(images);
      setGenerationStatus("");
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
    setDescriptionStatus("");
  }

  async function selectTab(nextTab: string) {
    setTab(nextTab);
    tabRef.current = nextTab;
    localStorage.setItem(LAST_TAB_KEY, nextTab);
    setMenuOpen(false);
    setEmailTemplateKey(null);
    setViewingEnquiryId(null);
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
      (tab === "faqs" &&
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

  if (checkingSession || (!data && signingIn))
    return (
      <div className="admin-auth admin-auth-loading" role="status" aria-live="polite">
        <span className="admin-auth-spinner" aria-hidden="true" />
        <p>Signing in…</p>
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
  const showEnquiryAlert = alertEnquiries.length > 0;
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
        {unreadCount > 0 && <span className="admin-menu-toggle-dot" aria-label="New enquiries" />}
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
            {item === "page content" ? "page settings" : item}
            {item === "enquiries" && unreadCount > 0 && (
              <span className="admin-nav-badge" aria-label={`${unreadCount} new`}>
                {unreadCount}
              </span>
            )}
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
        {showEnquiryAlert && (
          <div className="admin-toast admin-toast-enquiry" role="status" aria-live="polite">
            <span>
              {unreadCount} new {unreadCount === 1 ? "enquiry" : "enquiries"}
            </span>
            <span className="admin-toast-actions">
              <button
                className="admin-toast-view"
                type="button"
                onClick={() => {
                  dismissEnquiryAlert();
                  void selectTab("enquiries");
                }}
              >
                View
              </button>
              <button aria-label="Dismiss notification" type="button" onClick={dismissEnquiryAlert}>
                <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                  <path d="m5 5 10 10M15 5 5 15" />
                </svg>
              </button>
            </span>
          </div>
        )}
        {!adminBusyMessage && adminNotice && !showEnquiryAlert && (
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
        {replyingEnquiry && (
          <div
            className="admin-confirm-overlay"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeEnquiryReply();
            }}
          >
            <form
              aria-labelledby="enquiry-reply-title"
              aria-modal="true"
              className="admin-confirm-modal admin-reply-modal"
              role="dialog"
              onSubmit={sendEnquiryReply}
              noValidate
            >
              <h2 id="enquiry-reply-title">Reply to {replyingEnquiry.name || "customer"}</h2>
              <p>
                Sending to <strong>{replyingEnquiry.email}</strong>
              </p>
              {config && !config.resend && (
                <p className="admin-reply-error" role="alert">
                  Email sending is not configured. Add Resend to send replies.
                </p>
              )}
              <label className="field">
                <span>{replyingEnquiry.gmailThreaded ? "Conversation subject (kept for Gmail threading)" : "Subject"}</span>
                <input
                  readOnly={replyingEnquiry.gmailThreaded}
                  value={replySubject}
                  maxLength={200}
                  onChange={(event) => setReplySubject(event.target.value)}
                  disabled={sendingReply}
                />
              </label>
              <label className="field">
                <span>Message</span>
                <textarea
                  value={replyMessage}
                  rows={8}
                  maxLength={10000}
                  onChange={(event) => setReplyMessage(event.target.value)}
                  disabled={sendingReply}
                  autoFocus
                />
              </label>
              {replyError && (
                <p className="admin-reply-error" role="alert">
                  {replyError}
                </p>
              )}
              <div className="admin-confirm-actions">
                <button
                  className="btn btn-light"
                  type="button"
                  onClick={closeEnquiryReply}
                  disabled={sendingReply}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-dark admin-confirm-danger"
                  type="submit"
                  disabled={sendingReply || (config ? !config.resend : false)}
                >
                  {sendingReply ? "Sending..." : "Send reply"}
                </button>
              </div>
            </form>
          </div>
        )}
        {enquiryPendingDeletion && (
          <div
            className="admin-confirm-overlay"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !deletingEnquiryId)
                setEnquiryPendingDeletion(null);
            }}
          >
            <div
              aria-labelledby="enquiry-delete-title"
              aria-describedby="enquiry-delete-copy"
              aria-modal="true"
              className="admin-confirm-modal"
              role="dialog"
            >
              <h2 id="enquiry-delete-title">Delete this enquiry?</h2>
              <p id="enquiry-delete-copy">
                This will permanently delete the enquiry from{" "}
                <strong>{enquiryPendingDeletion.name}</strong>, including its reply
                history. This can&apos;t be undone.
              </p>
              <div className="admin-confirm-actions">
                <button
                  className="btn btn-light"
                  type="button"
                  onClick={() => setEnquiryPendingDeletion(null)}
                  disabled={Boolean(deletingEnquiryId)}
                >
                  Keep enquiry
                </button>
                <button
                  className="btn btn-dark admin-confirm-danger"
                  type="button"
                  onClick={() => void deleteEnquiry()}
                  disabled={Boolean(deletingEnquiryId)}
                >
                  {deletingEnquiryId ? "Deleting..." : "Yes, delete it"}
                </button>
              </div>
            </div>
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
              <h2 id="pickup-remove-title">Remove this {dateNoun} window?</h2>
              <p id="pickup-remove-copy">
                This will remove{" "}
                <strong>
                  {formatPickupDate(pickupDatePendingRemoval.date)}
                </strong>{" "}
                from the checkout calendar. Customers will not be able to choose
                this {dateNoun} window once it is removed.
              </p>
              <div className="admin-confirm-actions">
                <button
                  className="btn btn-light"
                  type="button"
                  onClick={() => setPickupDatePendingRemoval(null)}
                  disabled={Boolean(removingPickupDateId)}
                >
                  Keep window
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
        {viewOrderId && (() => {
          const order = orders.find((item) => item.id === viewOrderId);
          if (!order) return null;
          return (
            <div className="admin-confirm-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setViewOrderId(null); }}>
              <div aria-labelledby="order-view-title" aria-modal="true" className="admin-confirm-modal admin-order-modal" role="dialog">
                <h2 id="order-view-title">{order.customer?.name || "Order"}</h2>
                <button className="btn btn-light admin-order-close" type="button" aria-label="Close modal" title="Close" onClick={() => setViewOrderId(null)}>
                  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none">
                    <path d="m5 5 10 10M15 5 5 15" />
                  </svg>
                </button>
                <div className="admin-order-scroll">
                <dl className="admin-order-details">
                  <div><dt>Email</dt><dd>{order.customer?.email || "—"}</dd></div>
                  <div><dt>Collection</dt><dd>{order.fulfilment === "delivery" ? "Delivery" : "Pickup"}</dd></div>
                  {order.fulfilment === "delivery" && order.delivery ? (
                    <>
                      <div><dt>Delivery name</dt><dd>{order.delivery.name || "—"}</dd></div>
                      <div><dt>Delivery address</dt><dd>{`${order.delivery.street}, ${order.delivery.suburb} VIC ${order.delivery.postcode}`}</dd></div>
                    </>
                  ) : null}
                  <div><dt>Payment</dt><dd>{order.paymentStatus ? order.paymentStatus.charAt(0).toUpperCase() + order.paymentStatus.slice(1) : "—"}</dd></div>
                  <div><dt>Created</dt><dd>{order.createdAt?.slice(0, 10)}</dd></div>
                  <div>
                    <dt>Items</dt>
                    <dd className="admin-order-items">
                      {order.lines?.map((line, index) => (
                        <div key={index}><strong>{line.quantity ?? 1} × {line.productName}</strong><span>{line.variantLabel}{typeof line.unitPrice === "number" ? ` · $${line.unitPrice.toFixed(2)} each` : ""}</span></div>
                      ))}
                      {order.card && (
                        <div>
                          <strong>{order.card.quantity ?? 1} × {order.card.label || "Club Crumbie Card"}</strong>
                          {typeof order.card.price === "number" && <span>${order.card.price.toFixed(2)} each</span>}
                          {(order.card.names?.some(Boolean) || order.card.messages?.some(Boolean)) && (
                            <ol className="admin-card-messages">
                              {(order.card.messages ?? []).map((message, index) => (
                                <li key={index}>{order.card?.names?.[index] ? <strong>{order.card.names[index]}: </strong> : null}{message || <em>blank</em>}{order.card?.products?.[index] ? ` (${order.card.products[index]})` : ""}</li>
                              ))}
                            </ol>
                          )}
                        </div>
                      )}
                    </dd>
                  </div>
                </dl>
                </div>
              </div>
            </div>
          );
        })()}
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
              <h2 id="pickup-blocked-title">This {dateNoun} window has orders</h2>
              <p id="pickup-blocked-copy">
                You are about to remove{" "}
                <strong>
                  {formatPickupDate(blockedPickupDateRemoval.pickupDate.date)}
                </strong>
                . Existing orders keep this {dateNoun} window, but customers
                will no longer be able to choose it.
              </p>
              <p>
                {blockedPickupDateRemoval.orderCount}{" "}
                {blockedPickupDateRemoval.orderCount === 1
                  ? "order is"
                  : "orders are"}{" "}
                currently using this {dateNoun} window.
              </p>
              <div className="admin-confirm-actions">
                <button
                  className="btn btn-light"
                  type="button"
                  onClick={() => setBlockedPickupDateRemoval(null)}
                >
                  Keep window
                </button>
                <button
                  className="btn btn-dark admin-confirm-danger"
                  type="button"
                  onClick={() => {
                    const target = blockedPickupDateRemoval.pickupDate;
                    setBlockedPickupDateRemoval(null);
                    void removePickupDate(target);
                  }}
                >
                  Remove anyway
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
            {(tab === "pickup windows" || tab === "delivery windows") && (
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
                  Add {dateNoun} window
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
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {orders.length ? (
                orders.map((order) => (
                  <tr key={order.id}>
                    <td data-label="Customer" className="admin-order-customer">
                      <strong>{order.customer?.name}</strong>
                      <span>{order.customer?.email}</span>
                    </td>
                    <td data-label="Items" className="admin-order-items">
                      <div>
                        <strong>{order.lines?.[0] ? order.lines[0].productName : order.card ? "Club Crumbie Card" : "—"}</strong>
                        {(order.lines?.length ?? 0) + (order.card && order.lines?.length ? 1 : 0) > 1 && (
                          <span>+{(order.lines?.length ?? 0) + (order.card ? 1 : 0) - 1} more</span>
                        )}
                      </div>
                    </td>
                    <td data-label="Payment">
                      {order.paymentStatus
                        ? order.paymentStatus.charAt(0).toUpperCase() +
                          order.paymentStatus.slice(1)
                        : ""}
                    </td>
                    <td data-label="Created" className="admin-order-date">{order.createdAt?.slice(0, 10)}</td>
                    <td className="admin-table-action">
                      <button type="button" className="admin-text-button" onClick={() => setViewOrderId(order.id ?? null)}>View</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>No orders yet</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
        {tab === "pickup schedule" && (
          <div>
            {pickupDates.map((date) => (
              <div
                className="admin-schedule-group"
                key={date}
              >
                <h2>{formatPickupDate(date || "")}</h2>
                <ul className="admin-schedule-list">
                  {orders.flatMap((order) =>
                    (order.lines || [])
                      .filter((line) => line.pickupDate === date)
                      .map((line, index) => (
                        <li key={`${order.id}-${index}`}>
                          <strong>{order.customer?.name}</strong>
                          <span>
                            {line.quantity ?? 1} × {line.productName}
                            {order.card && index === 0 ? ` + ${order.card.quantity ?? 1} × ${order.card.label || "Club Crumbie Card"}` : ""}
                          </span>
                          <span>{line.pickupWindow}</span>
                        </li>
                      )),
                  )}
                </ul>
                <button className="btn btn-light" disabled>
                  Bulk ready email (configure Resend)
                </button>
              </div>
            ))}
          </div>
        )}
        {tab === "delivery schedule" && (() => {
          const deliveries = orders.filter((order) => order.fulfilment === "delivery" && order.delivery);
          const dates = Array.from(new Set(deliveries.map((order) => order.deliverySlot?.date || ""))).sort();
          if (!dates.length) return <p className="admin-sync-note" role="note">No delivery orders yet</p>;
          return (
            <div>
              {dates.map((date) => {
                const route = routeFromIvanhoe(
                  deliveries.filter((order) => (order.deliverySlot?.date || "") === date),
                  (order) => order.delivery?.postcode,
                );
                return (
                  <div className="admin-schedule-group" key={date || "unscheduled"}>
                    <h2>{date ? formatPickupDate(date) : "No delivery date"}</h2>
                    <p className="admin-schedule-note">Route starts and ends in Ivanhoe, nearest stop first.</p>
                    <table className="table admin-stack-table">
                      <thead>
                        <tr>
                          <th>Stop</th>
                          <th>Customer</th>
                          <th>Delivery address</th>
                          <th>Window</th>
                          <th aria-label="Actions" />
                        </tr>
                      </thead>
                      <tbody>
                        {route.map((order, index) => (
                          <tr key={order.id ?? index}>
                            <td data-label="Stop">{index + 1}</td>
                            <td data-label="Customer" className="admin-order-customer">
                              <strong>{order.delivery?.name || order.customer?.name}</strong>
                            </td>
                            <td data-label="Delivery address">{`${order.delivery?.street}, ${order.delivery?.suburb} VIC ${order.delivery?.postcode}`}</td>
                            <td data-label="Window">{order.deliverySlot?.window || "—"}</td>
                            <td className="admin-table-action">
                              <button type="button" className="admin-text-button" onClick={() => setViewOrderId(order.id ?? null)}>View</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          );
        })()}
        {tab === "enquiries" && !viewingEnquiryId && (() => {
          const typeOptions = Array.from(new Set(enquiries.filter((item) => item.id).map(enquiryTypeLabel))).sort();
          const visibleEnquiries = enquiries
            .filter((item) => enquiryTypeFilter === "all" || enquiryTypeLabel(item) === enquiryTypeFilter)
            .filter((item) => enquiryStatusFilter === "all" || enquiryDisplayStatus(item).key === enquiryStatusFilter)
            .sort((a, b) => {
              const diff = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
              return enquirySort === "oldest" ? diff : -diff;
            });
          return (
          <>
          <p className="admin-sync-note" role="note">
            <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="6.25" />
              <path d="M8 4.75V8l2.1 1.4" />
            </svg>
            <span>
              Replies sync from Gmail every five minutes. For the latest, treat the{" "}
              <strong>clubcrumbieadmin@gmail.com</strong> inbox as the source of truth.
            </span>
          </p>
          <div className="admin-enquiry-filters">
            <div className="admin-enquiry-filter">
              <span id="enquiry-type-filter-label">Type</span>
              <PremiumSelect
                labelId="enquiry-type-filter-label"
                value={enquiryTypeFilter}
                options={[{ value: "all", label: "All types" }, ...typeOptions.map((label) => ({ value: label, label }))]}
                placeholder="All types"
                onChange={setEnquiryTypeFilter}
              />
            </div>
            <div className="admin-enquiry-filter">
              <span id="enquiry-status-filter-label">Status</span>
              <PremiumSelect
                labelId="enquiry-status-filter-label"
                value={enquiryStatusFilter}
                options={[
                  { value: "all", label: "All statuses" },
                  { value: "new", label: "New" },
                  { value: "pending", label: "Pending" },
                  { value: "replied", label: "Replied" },
                ]}
                placeholder="All statuses"
                onChange={setEnquiryStatusFilter}
              />
            </div>
            <div className="admin-enquiry-filter">
              <span id="enquiry-sort-label">Sort by</span>
              <PremiumSelect
                labelId="enquiry-sort-label"
                value={enquirySort}
                options={[
                  { value: "newest", label: "Newest first" },
                  { value: "oldest", label: "Oldest first" },
                ]}
                placeholder="Newest first"
                onChange={setEnquirySort}
              />
            </div>
            {(enquiryTypeFilter !== "all" || enquiryStatusFilter !== "all" || enquirySort !== "newest") && (
              <button
                type="button"
                className="admin-filter-reset"
                onClick={() => {
                  setEnquiryTypeFilter("all");
                  setEnquiryStatusFilter("all");
                  setEnquirySort("newest");
                }}
              >
                Reset filters
              </button>
            )}
          </div>
          <table className="table admin-stack-table admin-enquiries-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Message</th>
                <th>Type</th>
                <th>Status</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {visibleEnquiries.length ? (
                visibleEnquiries.map((enquiry) => (
                  <tr
                    key={enquiry.id}
                    className={enquiry.id ? "admin-row-clickable" : undefined}
                    tabIndex={enquiry.id ? 0 : undefined}
                    onClick={(event) => {
                      if (!enquiry.id || (event.target as HTMLElement).closest(".admin-kebab")) return;
                      openEnquiry(enquiry);
                    }}
                    onKeyDown={(event) => {
                      if (!enquiry.id || event.target !== event.currentTarget) return;
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openEnquiry(enquiry);
                      }
                    }}
                  >
                    <td data-label="Name">
                      {enquiry.name}
                      <br />
                      <small>
                        {enquiry.email}
                        <br />
                        {enquiry.phone}
                      </small>
                    </td>
                    <td data-label="Message">
                      <span className="admin-enquiry-preview">{enquiry.request}</span>
                      {enquiry.replies?.length ? (
                        <small className="admin-enquiry-reply-count">
                          {enquiry.replies.length} {enquiry.replies.length === 1 ? "reply" : "replies"}
                        </small>
                      ) : null}
                    </td>
                    <td data-label="Type">
                      {enquiryTypeLabels[enquiry.enquiryType || ""] || enquiry.enquiryType || "General enquiry"}
                    </td>
                    <td data-label="Status">
                      <EnquiryStatus enquiry={enquiry} />
                    </td>
                    <td className="admin-table-action">
                      {enquiry.id && (
                        <div className="admin-kebab">
                          <button
                            aria-expanded={enquiryMenuId === enquiry.id}
                            aria-haspopup="menu"
                            aria-label="Enquiry actions"
                            className="admin-kebab-trigger"
                            type="button"
                            onClick={() =>
                              setEnquiryMenuId((current) =>
                                current === enquiry.id ? null : enquiry.id!,
                              )
                            }
                            disabled={updatingEnquiryId === enquiry.id}
                          >
                            <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18">
                              <circle cx="12" cy="5" r="1.8" fill="currentColor" />
                              <circle cx="12" cy="12" r="1.8" fill="currentColor" />
                              <circle cx="12" cy="19" r="1.8" fill="currentColor" />
                            </svg>
                          </button>
                          {enquiryMenuId === enquiry.id && (
                            <div className="admin-kebab-menu" role="menu">
                              {(["new", "pending", "replied"] as const)
                                .filter((status) => enquiryDisplayStatus(enquiry).key !== status)
                                .map((status) => (
                                  <button
                                    key={status}
                                    role="menuitem"
                                    type="button"
                                    onClick={() => {
                                      setEnquiryMenuId(null);
                                      void setEnquiryStatus(enquiry, status);
                                    }}
                                  >
                                    <span className={`admin-status-dot is-${status}`} aria-hidden="true" />
                                    Mark as {status}
                                  </button>
                                ))}
                              <button
                                className="is-danger"
                                role="menuitem"
                                type="button"
                                onClick={() => {
                                  setEnquiryMenuId(null);
                                  setEnquiryPendingDeletion(enquiry);
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>{enquiries.length ? "No enquiries match these filters" : "No enquiries yet"}</td>
                </tr>
              )}
            </tbody>
          </table>
          </>
          );
        })()}
        {tab === "enquiries" && viewingEnquiryId && (() => {
          const enquiry = enquiries.find((item) => item.id === viewingEnquiryId);
          const formatDate = (value: string) =>
            new Date(value).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
          const back = (
            <button className="text-button" type="button" onClick={() => setViewingEnquiryId(null)}>
              <svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="m10 3-5 5 5 5" /></svg>
              Back to enquiries
            </button>
          );
          if (!enquiry) {
            return (
              <div className="admin-template-editor-heading">
                {back}
                <p>This enquiry could not be found.</p>
              </div>
            );
          }
          return (
            <div className="admin-enquiry-detail">
              <div className="admin-template-editor-heading">
                {back}
                <h2>{enquiry.name || "Customer enquiry"}</h2>
              </div>
              <dl className="admin-enquiry-meta">
                <div>
                  <dt>Email</dt>
                  <dd>{enquiry.email ? <a href={`mailto:${enquiry.email}`}>{enquiry.email}</a> : "—"}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{enquiry.phone ? <a href={`tel:${enquiry.phone}`}>{enquiry.phone}</a> : "—"}</dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>{enquiryTypeLabels[enquiry.enquiryType || ""] || enquiry.enquiryType || "General enquiry"}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd><EnquiryStatus enquiry={enquiry} /></dd>
                </div>
              </dl>
              <ol className="admin-enquiry-thread">
                <li className="admin-enquiry-message is-customer">
                  <div className="admin-enquiry-message-head">
                    <strong>{enquiry.name || "Customer"}</strong>
                    {enquiry.createdAt && <small>{formatDate(enquiry.createdAt)}</small>}
                  </div>
                  <p>{enquiry.request || "No message provided."}</p>
                </li>
                {enquiry.replies?.map((reply) => (
                  <li className={`admin-enquiry-message ${reply.direction === "incoming" ? "is-customer" : "is-reply"}`} key={reply.externalId || reply.sentAt}>
                    <div className="admin-enquiry-message-head">
                      <strong>{reply.direction === "incoming" ? enquiry.name || "Customer" : "Club Crumbie"}{reply.source === "gmail" ? " · Gmail" : ""}</strong>
                      <small>{formatDate(reply.sentAt)}</small>
                    </div>
                    {reply.subject && <span className="admin-enquiry-message-subject">{reply.subject}</span>}
                    <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{enquiryMessageDisplay(reply.message, reply.direction !== "incoming")}</p>
                    {enquiryMessageDisplay(reply.message, reply.direction !== "incoming") !== reply.message.replace(/\r\n/g, "\n") && <details className="admin-email-details"><summary>Show full email<svg aria-hidden="true" viewBox="0 0 16 16" fill="none"><path d="m4 6 4 4 4-4" /></svg></summary><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{reply.message}</p></details>}
                  </li>
                ))}
              </ol>
              <div className="admin-editor-actions">
                <button
                  className="btn btn-light"
                  type="button"
                  onClick={() => openEnquiryReply(enquiry)}
                  disabled={!enquiry.email}
                >
                  Reply
                </button>
              </div>
            </div>
          );
        })()}
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
                <div className={`field${productFieldErrors.price4 ? " has-error" : ""}`}>
                  <label htmlFor="product-price-4">Box of 4 price</label>
                  <div className="quantity-stepper admin-number-stepper">
                    <div className="admin-price-wrap">
                    {newProduct.price4.trim() && <span className="admin-price-prefix" aria-hidden="true">$</span>}
                    <input
                      id="product-price-4"
                      inputMode="decimal"
                      maxLength={8}
                      value={newProduct.price4}
                      onChange={(event) => setNewProduct({ ...newProduct, price4: cleanPriceInput(event.target.value) })}
                      onBlur={() => setNewProduct({ ...newProduct, price4: formatPriceInput(newProduct.price4) })}
                    />
                    </div>
                    <div className="quantity-stepper-controls">
                      <button
                        type="button"
                        onClick={() => adjustProductPrice("price4", -1)}
                        disabled={Number(newProduct.price4) <= 0}
                        aria-label="Decrease box of 4 price"
                      >
                        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
                          <path d="M3 8h10" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustProductPrice("price4", 1)}
                        aria-label="Increase box of 4 price"
                      >
                        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
                          <path d="M8 3v10M3 8h10" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  {productFieldErrors.price4 && (
                    <p className="field-error" role="alert">{productFieldErrors.price4}</p>
                  )}
                </div>
                <div className={`field${productFieldErrors.price6 ? " has-error" : ""}`}>
                  <label htmlFor="product-price-6">Box of 6 price</label>
                  <div className="quantity-stepper admin-number-stepper">
                    <div className="admin-price-wrap">
                    {newProduct.price6.trim() && <span className="admin-price-prefix" aria-hidden="true">$</span>}
                    <input
                      id="product-price-6"
                      inputMode="decimal"
                      maxLength={8}
                      value={newProduct.price6}
                      onChange={(event) => setNewProduct({ ...newProduct, price6: cleanPriceInput(event.target.value) })}
                      onBlur={() => setNewProduct({ ...newProduct, price6: formatPriceInput(newProduct.price6) })}
                    />
                    </div>
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
                    <div className="admin-price-wrap">
                    {newProduct.price12.trim() && <span className="admin-price-prefix" aria-hidden="true">$</span>}
                    <input
                      id="product-price-12"
                      inputMode="decimal"
                      maxLength={8}
                      value={newProduct.price12}
                      onChange={(event) => setNewProduct({ ...newProduct, price12: cleanPriceInput(event.target.value) })}
                      onBlur={() => setNewProduct({ ...newProduct, price12: formatPriceInput(newProduct.price12) })}
                    />
                    </div>
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
                    className="btn btn-light admin-generate-button"
                    onClick={generateProductDescription}
                    disabled={descriptionStatus.startsWith("Generating")}
                    aria-busy={descriptionStatus.startsWith("Generating")}
                    aria-label={
                      descriptionStatus.startsWith("Generating")
                        ? "Generating description"
                        : "Generate description with OpenAI"
                    }
                  >
                    <span className="admin-generate-label">
                      Generate <span className="admin-generate-extra">description </span>with OpenAI
                    </span>
                    <span className="admin-generate-loading">Generating...</span>
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
                  <AdminSwitch
                    checked={heroMode === "carousel"}
                    onChange={(checked) => setHeroMode(checked ? "carousel" : "cookie")}
                    label="Use a photo carousel instead of the 3D cookie"
                  />
                  {heroMode === "carousel" && (
                    <div className="admin-hero-carousel-panel">
                      <p>Upload photos to show as a swipeable carousel on this product page in place of the 3D cookie. The first photo appears first, and you can reorder or remove photos below.</p>
                      <label
                        className={`admin-reference-dropzone admin-gallery-dropzone${heroDragActive ? " is-active" : ""}`}
                        htmlFor="product-hero-photos"
                        tabIndex={0}
                        onDragEnter={(event) => {
                          event.preventDefault();
                          setHeroDragActive(true);
                        }}
                        onDragOver={(event) => event.preventDefault()}
                        onDragLeave={(event) => {
                          if (event.currentTarget === event.target) setHeroDragActive(false);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          setHeroDragActive(false);
                          addHeroFiles(Array.from(event.dataTransfer.files));
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            document.getElementById("product-hero-photos")?.click();
                          }
                        }}
                      >
                        <svg aria-hidden="true" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 16V5m0 0L8 9m4-4 4 4M5 15v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3" />
                        </svg>
                        <span>Click to upload photos</span>
                        <small>or drag and drop · JPG, PNG or WebP · 10MB each</small>
                        <input
                          id="product-hero-photos"
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(event) => {
                            addHeroFiles(Array.from(event.target.files || []));
                            event.target.value = "";
                          }}
                        />
                      </label>
                      {(heroImages.length > 0 || heroFiles.length > 0) && (
                        <PhotoReorderList
                          images={heroImages}
                          files={heroFiles}
                          label={(index) => (index === 0 ? "First photo" : `Photo ${index + 1}`)}
                          onImagesChange={setHeroImages}
                          onFilesChange={setHeroFiles}
                        />
                      )}
                      <div className="admin-card-image-field">
                        <strong>Crumbs page image</strong>
                        <p>Optional. Shown only on the Crumbs page and homepage card, never on this product page. Leave empty to use the default cookie.</p>
                        <label
                          className={`admin-reference-dropzone admin-gallery-dropzone${cardDragActive ? " is-active" : ""}`}
                          htmlFor="product-card-photo"
                          tabIndex={0}
                          onDragEnter={(event) => {
                            event.preventDefault();
                            setCardDragActive(true);
                          }}
                          onDragOver={(event) => event.preventDefault()}
                          onDragLeave={(event) => {
                            if (event.currentTarget === event.target) setCardDragActive(false);
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            setCardDragActive(false);
                            addCardFile(Array.from(event.dataTransfer.files));
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              document.getElementById("product-card-photo")?.click();
                            }
                          }}
                        >
                          <svg aria-hidden="true" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 16V5m0 0L8 9m4-4 4 4M5 15v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3" />
                          </svg>
                          <span>Click to upload a photo</span>
                          <small>or drag and drop · JPG, PNG or WebP · 10MB</small>
                          <input
                            id="product-card-photo"
                            type="file"
                            accept="image/*"
                            onChange={(event) => {
                              addCardFile(Array.from(event.target.files || []));
                              event.target.value = "";
                            }}
                          />
                        </label>
                        {(cardImage || cardFile) && (
                          <ol className="admin-product-images">
                            <li>
                              {cardFile ? <PendingPhotoPreview file={cardFile} /> : <Image src={cardImage} alt="" width={56} height={44} unoptimized />}
                              <div>
                                <strong>{cardFile ? "New photo (saved on save)" : "Crumbs page image"}</strong>
                                <span>{cardFile ? cardFile.name : cardImage.split("/").pop()}</span>
                              </div>
                              <div className="admin-product-image-actions">
                                <button
                                  className="text-button"
                                  type="button"
                                  onClick={() => {
                                    setCardFile(null);
                                    if (!cardFile) setCardImage("");
                                  }}
                                >
                                  Remove
                                </button>
                              </div>
                            </li>
                          </ol>
                        )}
                      </div>
                    </div>
                  )}
                  {heroMode === "cookie" && (<>
                  <p>
                    Add up to five reference photos and generate the complete
                    storefront image set. OpenAI automatically creates a
                    side-profile image, like the Signature Crumbie, as the
                    storefront cover; any additional images, opening bird’s-eye, become the
                    rotatable product-page view. Generating a new set replaces
                    the current product imagery.
                  </p>
                  <label
                    className={`admin-reference-dropzone admin-gallery-dropzone${referenceDropActive ? " is-active" : ""}`}
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
                    <svg aria-hidden="true" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 16V5m0 0L8 9m4-4 4 4M5 15v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3" />
                    </svg>
                    <span>Click to upload photos</span>
                    <small>or drag and drop · up to 5 images · 10MB each</small>
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
                    options={GENERATED_IMAGE_COUNTS.map((count) => ({
                      value: String(count),
                      label: `${count} image${count === 1 ? "" : "s"}${count === RECOMMENDED_IMAGE_COUNT ? " (full 360° rotation)" : ""}`,
                    }))}
                    placeholder={`${RECOMMENDED_IMAGE_COUNT} images (recommended)`}
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
                  {generationStatus.startsWith("Generating") || generationStatus.startsWith("Connection lost") ? (
                    <div className="admin-generate-progress" role="status">
                      <div className="admin-generate-progress-text">
                        <span>
                          {generationProgress.total
                            ? `Generating image ${Math.min(generationProgress.done + 1, generationProgress.total)} of ${generationProgress.total}`
                            : "Preparing photos"}
                        </span>
                        <span>
                          {generationProgress.total
                            ? `${Math.round((generationProgress.done / generationProgress.total) * 100)}%`
                            : ""}
                        </span>
                      </div>
                      <div
                        className="admin-generate-progress-track"
                        role="progressbar"
                        aria-label="Image generation progress"
                        aria-valuemin={0}
                        aria-valuemax={generationProgress.total || 1}
                        aria-valuenow={generationProgress.done}
                      >
                        <div
                          className="admin-generate-progress-fill"
                          style={{
                            width: `${generationProgress.total ? Math.max(4, (generationProgress.done / generationProgress.total) * 100) : 4}%`,
                          }}
                        />
                      </div>
                    </div>
                  ) : (
                    <button
                      className="btn btn-light admin-generate-button"
                      type="button"
                      onClick={generateProductImage}
                    >
                      <span className="admin-generate-label">
                        Generate {generatedImageCount} image{generatedImageCount === 1 ? "" : "s"} with OpenAI
                      </span>
                    </button>
                  )}
                  {generationStatus &&
                    !generationStatus.startsWith("Generating") &&
                    !generationStatus.startsWith("Connection lost") && (
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
                  </>)}
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
                        ? "Save changes"
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
                  <th className="admin-product-price">Four</th>
                  <th className="admin-product-price">Six</th>
                  <th className="admin-product-price">Twelve</th>
                  <th className="admin-table-action">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {orderedProducts.length ? (
                  orderedProducts.map((product, rowIndex) => (
                    <tr
                      key={product.id}
                      data-product-id={product.id}
                      className={draggedProduct === product.id ? "is-dragging" : undefined}
                      onDragOver={(event) => {
                        if (!draggedProduct) return;
                        event.preventDefault();
                        moveProduct(draggedProduct, product.id);
                      }}
                      onDrop={(event) => event.preventDefault()}
                    >
                      <td>
                        <div className="admin-product-cell">
                          {product.id === heroProductId ? (
                            <span className="admin-drag-handle-spacer" aria-hidden="true" />
                          ) : (
                            <button
                              className="admin-drag-handle"
                              type="button"
                              draggable
                              aria-label={`Reorder ${product.name}. Use arrow keys to move.`}
                              onPointerDown={(event) => {
                                if (event.pointerType === "mouse") return;
                                touchDragRef.current = true;
                                event.currentTarget.setPointerCapture(event.pointerId);
                                setDraggedProduct(product.id);
                              }}
                              onPointerMove={(event) => {
                                if (!touchDragRef.current) return;
                                const row = document
                                  .elementFromPoint(event.clientX, event.clientY)
                                  ?.closest<HTMLElement>("tr[data-product-id]");
                                const targetId = row?.dataset.productId;
                                if (targetId) moveProduct(product.id, targetId);
                              }}
                              onPointerUp={() => {
                                if (!touchDragRef.current) return;
                                touchDragRef.current = false;
                                setDraggedProduct(null);
                                void saveProductOrder();
                              }}
                              onPointerCancel={() => {
                                touchDragRef.current = false;
                                setDraggedProduct(null);
                              }}
                              onDragStart={(event) => {
                                if (touchDragRef.current) {
                                  event.preventDefault();
                                  return;
                                }
                                const row = event.currentTarget.closest("tr");
                                if (row) event.dataTransfer.setDragImage(row, 24, row.offsetHeight / 2);
                                event.dataTransfer.effectAllowed = "move";
                                event.dataTransfer.setData("text/plain", product.id);
                                setDraggedProduct(product.id);
                              }}
                              onDragEnd={() => {
                                setDraggedProduct(null);
                                void saveProductOrder();
                              }}
                              onKeyDown={(event) => {
                                const offset = event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
                                if (!offset) return;
                                event.preventDefault();
                                const target = orderedProducts[rowIndex + offset];
                                if (!target || target.id === heroProductId) return;
                                const tbody = event.currentTarget.closest("tbody");
                                moveProduct(product.id, target.id);
                                requestAnimationFrame(() => {
                                  tbody?.querySelectorAll<HTMLButtonElement>(".admin-drag-handle")[rowIndex - (heroProductId ? 1 : 0) + offset]?.focus();
                                  void saveProductOrder();
                                });
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
                          )}
                          <div>
                            <div className="admin-product-name">
                              {product.name}
                              {product.id === heroProductId && <span className="admin-hero-tag">Hero</span>}
                            </div>
                            <div className="admin-product-description">
                              {product.description}
                            </div>
                          </div>
                        </div>
                      </td>
                      {[4, 6, 12].map((quantity) => {
                        const variant = product.variants.find(
                          (item) => item.quantity === quantity,
                        );
                        return (
                          <td
                            className="admin-product-price"
                            data-label={quantity === 4 ? "Four" : quantity === 6 ? "Six" : "Twelve"}
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
                        {product.id === heroProductId && <span aria-hidden="true" className="admin-hero-tag admin-hero-tag-action">Hero</span>}
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
            {cardSettings && managedProducts.length > 0 && (
              <AdminAccordion title="Product layout">
                <PromoSettings products={managedProducts} initial={cardSettings} begin={beginAdminAction} finish={finishAdminAction} onSaved={handlePromoSaved} />
              </AdminAccordion>
            )}
            {cardSettings && (
              <AdminAccordion title="Product gallery">
                <CardSettings part="page" begin={beginAdminAction} finish={finishAdminAction} initial={cardSettings} />
              </AdminAccordion>
            )}
            {cardSettings && (
              <AdminAccordion title="Search image">
                <CardSettings part="search" begin={beginAdminAction} finish={finishAdminAction} initial={cardSettings} />
              </AdminAccordion>
            )}
            {cardSettings && (
              <AdminAccordion title="Product banner">
                <CardSettings part="banner" begin={beginAdminAction} finish={finishAdminAction} initial={cardSettings} />
              </AdminAccordion>
            )}
            {cardSettings && (
              <AdminAccordion title="Card settings">
                <CardSettings part="card" begin={beginAdminAction} finish={finishAdminAction} initial={cardSettings} />
              </AdminAccordion>
            )}
            {cardSettings && (
              <AdminAccordion title="Checkout messages">
                <MessageSettings begin={beginAdminAction} finish={finishAdminAction} initial={cardSettings} />
              </AdminAccordion>
            )}
          </>
        )}
        {(tab === "pickup windows" || tab === "delivery windows") && (
          <>
            {deliveryTab && cardSettings && !deliveryOn && (
              <p className="admin-sync-note admin-delivery-off-note" role="note">
                <svg aria-hidden="true" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="8" r="6.25" />
                  <path d="M8 4.75V8l2.1 1.4" />
                </svg>
                <span>Delivery is turned off and won&apos;t display on the website.</span>
              </p>
            )}
            <form className="admin-modal admin-add-date" onSubmit={addPickupDate} noValidate>
              <div className="admin-modal-header">
                <h2>Add {dateNoun} window</h2>
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
                <label htmlFor="new-pickup-date">{deliveryTab ? "Delivery" : "Pickup"} window</label>
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
                  {pickupDateStatus === "Saving..." ? "Adding…" : `Add ${dateNoun} window`}
                </button>
                {pickupDateStatus && pickupDateStatus !== "Saving..." && (
                  <span>{pickupDateStatus}</span>
                )}
              </div>
            </form>
            <div>
            <div
              className="admin-filter-tabs"
              role="tablist"
              aria-label={`${deliveryTab ? "Delivery" : "Pickup"} window filters`}
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
                    ? `All ${dateNoun} windows`
                    : filter === "closed"
                      ? `Closed ${dateNoun} windows`
                      : `Open ${dateNoun} windows`}
                </button>
              ))}
            </div>
            {(() => {
              const visiblePickupDates = managedDates.filter(
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
                      <th>Window</th>
                      <th>{deliveryTab ? "Delivery" : "Pickup"} window</th>
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
                        <td colSpan={4}>No {dateNoun} windows</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              );
            })()}
            </div>
            {deliveryTab && cardSettings && (
              <AdminAccordion title="Delivery settings">
                <DeliverySettings begin={beginAdminAction} finish={finishAdminAction} initial={cardSettings} onSaved={(on) => setCardSettings((current) => (current ? { ...current, deliveryEnabled: on ? "true" : "false" } : current))} />
              </AdminAccordion>
            )}
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
            <div className="admin-editor-actions"><button className={`btn btn-light${contentStatus === "Saving..." ? " btn-loading" : ""}`} disabled={contentStatus === "Saving..." || !contentChanged}>{contentStatus === "Saving..." && <span className="btn-spinner" aria-hidden="true" />}{contentStatus === "Saving..." ? "Saving…" : "Save changes"}</button>{contentStatus && contentStatus !== "Saving..." && <span>{contentStatus}</span>}</div>
          </form>;
        })()}
        {tab === "page content" && (
          <div ref={pageContentRef}>
            <div className="admin-accordion-controls">
              <button type="button" onClick={toggleAccordions}>
                <svg aria-hidden="true" viewBox="0 0 16 16" fill="none">
                  <path d={accordionsAllOpen ? "m4 10 4-4 4 4" : "m4 6 4 4 4-4"} />
                </svg>
                {accordionsAllOpen ? "Collapse all" : "Expand all"}
              </button>
            </div>
            {cardSettings && managedProducts.length > 0 && (
              <AdminAccordion title="Hero layout">
                <LandingHeroSettings products={managedProducts} initial={cardSettings} begin={beginAdminAction} finish={finishAdminAction} onSaved={(next) => setCardSettings((current) => (current ? { ...current, ...next } : current))} />
              </AdminAccordion>
            )}
            {pageContentModules.map(([key, title]) => (
              <AdminAccordion key={key} title={title}>
                <ContentEditor moduleName={key} begin={beginAdminAction} finish={finishAdminAction} />
              </AdminAccordion>
            ))}
          </div>
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
