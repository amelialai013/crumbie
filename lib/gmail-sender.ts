import "server-only";
import { z } from "zod";

const receipt = z.object({ ok: z.literal(true), messageId: z.string().regex(/^[a-f0-9]+$/i), sentAt: z.string().datetime(), subject: z.string() });
export async function sendGmailReply(url: string, reply: { id: string; requestId: string; to: string; subject: string; threadToken: string; text: string; html: string }) {
 if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url)) throw new Error("Invalid Gmail sender URL");
 const secret = process.env.GMAIL_REPLY_SYNC_SECRET?.trim();
 if (!secret || secret.length < 32) throw new Error("Gmail sender is not configured");
 // Never fall back to another provider after a timeout: Gmail may already have sent it.
 const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ ...reply, secret }), signal: AbortSignal.timeout(45000), cache: "no-store" });
 const result = receipt.safeParse(await response.json());
 if (!response.ok || !result.success) throw new Error("Gmail delivery was not confirmed. Retry the same reply to check its delivery status.");
 return result.data;
}
