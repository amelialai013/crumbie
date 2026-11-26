import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Newsletter", robots: { index: false } };

const copy: Record<string, [string, string]> = {
  ok: ["You're in", "Thanks for confirming. You'll hear from us about new boxes and seasonal flavours."],
  invalid: ["That link didn't work", "The confirmation link is invalid or incomplete. Try signing up again from the homepage."],
  error: ["Something went wrong", "We couldn't confirm your subscription just now. Please try the link again in a moment."],
};

export default async function NewsletterConfirmed({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "ok" } = await searchParams;
  const [title, message] = copy[status] ?? copy.error;
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
          Explore Crumbs
          <svg viewBox="0 0 20 20" aria-hidden="true" fill="none"><path d="m7 4.5 5.5 5.5L7 15.5" /></svg>
        </Link>
      </div>
    </section>
  );
}
