"use client";

import { useState } from "react";

export default function NewsletterSignup({ heading, body, button, note, doneTitle, doneBody, wordTwo, wordThree, wordFour }: { heading: string; body: string; button: string; note: string; doneTitle: string; doneBody: string; wordTwo: string; wordThree: string; wordFour: string }) {
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") || "").trim();
    if (!email || !form.elements.namedItem("email") || !(form.elements.namedItem("email") as HTMLInputElement).validity.valid) {
      setMessage(email ? "Please enter a valid email address." : "Please enter your email address.");
      setStatus("error");
      return;
    }
    setStatus("sending");
    setMessage("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.get("email"), website: data.get("website") }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Something went wrong. Please try again.");
      }
      form.reset();
      setStatus("done");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  return (
    <div className="newsletter-signup">
      <div className="newsletter-marquee" aria-hidden="true">
        <div className="newsletter-track">
          {[0, 1].map((n) => (
            <div key={n} className="newsletter-run">
              {[heading, wordTwo, wordThree, wordFour, heading, wordTwo, wordThree, wordFour].map((word, i) => (
                <span key={i}>{word}</span>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="newsletter-copy">
        <h2>{heading}<span className="newsletter-echo" aria-hidden="true">{wordTwo}</span><span className="newsletter-echo" aria-hidden="true">{wordThree}</span></h2>
        <p className="newsletter-lede">{body}</p>
      </div>
      {status === "done" ? (
        <div className="newsletter-done" role="status">
          <svg aria-hidden="true" viewBox="0 0 16 16"><path d="m3.5 8.5 3 3 6-7" pathLength="1" /></svg>
          <strong>{doneTitle}</strong>
          <span>{doneBody}</span>
        </div>
      ) : (
        <>
          <form className="newsletter-form" onSubmit={submit} noValidate>
            <label className="sr-only" htmlFor="newsletter-email">Email address</label>
            <input id="newsletter-email" name="email" type="email" required autoComplete="email" aria-invalid={status === "error"} aria-describedby={status === "error" ? "newsletter-error" : undefined} placeholder="Your email address" />
            <input className="newsletter-hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
            <button type="submit" disabled={status === "sending"}>
              {status === "sending" ? "Joining…" : button}
              <svg aria-hidden="true" viewBox="0 0 20 20"><path d="m7 4.5 5.5 5.5L7 15.5" /></svg>
            </button>
            {status === "error" ? <p className="field-error newsletter-error" id="newsletter-error" role="alert">{message}</p> : null}
          </form>
          {note ? <p className="newsletter-note">{note}</p> : null}
        </>
      )}
    </div>
  );
}
