"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

const STORAGE_KEY = "crumbie-subscribe-popup";
const DELAY_MS = 5000;
const HIDDEN_ON = ["/admin", "/checkout", "/order-confirmation", "/newsletter"];

type Props = { image: string; heading: string; body: string; placeholder: string; button: string; dismiss: string; doneTitle: string; doneBody: string };

export default function SubscribePopup({ image, heading, body, placeholder, button, dismiss, doneTitle, doneBody }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const hidden = HIDDEN_ON.some((path) => pathname.startsWith(path));

  useEffect(() => {
    if (hidden) return;
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      return;
    }
    new Image().src = image;
    const timer = window.setTimeout(() => {
      setOpen(true);
      try {
        localStorage.setItem(STORAGE_KEY, "seen");
      } catch {}
    }, DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [hidden, image]);

  function close() {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setClosing(false);
    }, 380);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, closing]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") || "").trim();
    if (!email || !inputRef.current?.validity.valid) {
      setMessage(email ? "Please enter a valid email address." : "Please enter your email address.");
      setStatus("error");
      inputRef.current?.focus();
      return;
    }
    setStatus("sending");
    setMessage("");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, website: data.get("website") }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "Something went wrong. Please try again.");
      }
      setStatus("done");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      setStatus("error");
    }
  }

  if (!open || hidden) return null;

  return (
    <div className={`subscribe-popup${closing ? " is-closing" : ""}`} role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <div className="subscribe-popup-card" role="dialog" aria-modal="true" aria-labelledby="subscribe-popup-title">
        <button type="button" className="subscribe-popup-close" aria-label="Close" onClick={close}>
          <svg aria-hidden="true" viewBox="0 0 20 20"><path d="m5 5 10 10M15 5 5 15" /></svg>
        </button>
        <div className="subscribe-popup-image" aria-hidden="true" style={{ backgroundImage: `url("${image}")` }} />
        <div className="subscribe-popup-body">
          {status === "done" ? (
            <div className="subscribe-popup-done" role="status">
              <svg aria-hidden="true" viewBox="0 0 16 16"><path d="m3.5 8.5 3 3 6-7" pathLength="1" /></svg>
              <h2 id="subscribe-popup-title">{doneTitle}</h2>
              <p>{doneBody}</p>
            </div>
          ) : (
            <>
              <h2 id="subscribe-popup-title">{heading}</h2>
              <p>{body}</p>
              <form onSubmit={submit} noValidate>
                <label className="sr-only" htmlFor="subscribe-popup-email">Email address</label>
                <input ref={inputRef} id="subscribe-popup-email" name="email" type="email" autoComplete="email" placeholder={placeholder} aria-invalid={status === "error"} aria-describedby={status === "error" ? "subscribe-popup-error" : undefined} />
                <input className="newsletter-hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
                <button type="submit" className={`subscribe-popup-submit${status === "sending" ? " btn-loading" : ""}`} disabled={status === "sending"}>
                  {status === "sending" && <span className="btn-spinner" aria-hidden="true" />}
                  {button}
                </button>
                {status === "error" && <p className="subscribe-popup-error" id="subscribe-popup-error" role="alert">{message}</p>}
              </form>
              <button type="button" className="subscribe-popup-dismiss" onClick={close}>{dismiss}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
