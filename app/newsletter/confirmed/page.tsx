import type { Metadata } from "next";
import Link from "next/link";
import { getRecord } from "@/lib/store";

export const metadata: Metadata = { title: "Newsletter", robots: { index: false } };

const copy: Record<string, [string, string]> = {
  ok: ["You're in", "Welcome to the Club. We'll let you know when a fresh box is out of the oven, along with seasonal flavours and the odd sweet surprise."],
  invalid: ["That link didn't work", "The confirmation link is invalid or incomplete. Try signing up again from the homepage."],
  error: ["Something went wrong", "We couldn't confirm your subscription just now. Please try the link again in a moment."],
};

export default async function NewsletterConfirmed({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "ok" } = await searchParams;
  const content = status === "ok" ? await getRecord<{ fields?: Record<string, string> }>("content", "newsletter confirmed").catch(() => null) : null;
  const f = content?.fields || {};
  const [defaultTitle, defaultMessage] = copy[status] ?? copy.error;
  const title = (status === "ok" && f.pageTitle) || defaultTitle;
  const message = (status === "ok" && f.message) || defaultMessage;
  return (
    <section className="page-hero">
      <div className="shell newsletter-confirmed">
        {status === "ok" && (
          <span className="confirmed-ring" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path pathLength="1" d="m5 12.5 4.5 4.5L19 7.5" /></svg>
          </span>
        )}
        <h1 className="page-title">{title}</h1>
        <p>{message}</p>
        <Link className="btn btn-dark btn-arrow" href="/crumbs">
          {(status === "ok" && f.buttonLabel) || "Explore Crumbs"}
          <svg viewBox="0 0 20 20" aria-hidden="true" fill="none"><path d="m7 4.5 5.5 5.5L7 15.5" /></svg>
        </Link>
      </div>
    </section>
  );
}
