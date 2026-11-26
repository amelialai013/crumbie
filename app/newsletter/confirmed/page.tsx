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
      <div className="shell">
        <h1 className="page-title">{title}</h1>
        <p>{message}</p>
        <p><Link className="button" href="/">Back to Club Crumbie</Link></p>
      </div>
    </section>
  );
}
