import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { emailAddresses, enquiryIdFromSubject, enquiryMailbox } from "@/lib/enquiry-mail";
import { appendEnquiryReply, getRecord, setRecord } from "@/lib/store";

import { enquiryFromToken, messageIds, messageKey } from "@/lib/enquiry-thread";

const schema = z.object({
 threadToken: z.string().max(200).optional(),
 rfcMessageId: z.string().max(1000).optional(),
 references: z.string().max(20000).optional(),
 messageId: z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/),
 subject: z.string().max(500),
 from: z.string().max(500),
 to: z.string().max(2000),
 cc: z.string().max(2000).optional(),
 message: z.string().trim().min(1).max(50000),
 sentAt: z.string().datetime(),
});

export async function POST(req: Request) {
 const secret = process.env.GMAIL_REPLY_SYNC_SECRET?.trim();
 if (!secret || secret.length < 32) return NextResponse.json({ error: "Gmail sync is not configured." }, { status: 503 });
 const auth = Buffer.from(req.headers.get("authorization") || "");
 const expected = Buffer.from(`Bearer ${secret}`);
 if (auth.length !== expected.length || !timingSafeEqual(auth, expected)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 const body = await req.text();
 if (Buffer.byteLength(body) > 100000) return NextResponse.json({ error: "Message too large." }, { status: 413 });
 let json: unknown;
 try { json = JSON.parse(body); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
 if (json && typeof json === "object" && "capability" in json && json.capability === "message-headers-v2") {
  await setRecord("integration", "gmail-headers", { version: 2, enabledAt: new Date().toISOString() });
  return NextResponse.json({ ok: true });
 }
 const parsed = schema.safeParse(json);
 if (!parsed.success) return NextResponse.json({ error: "Invalid reply." }, { status: 400 });
 const reply = parsed.data;
 const signedId = reply.threadToken ? enquiryFromToken(reply.threadToken) : null;
 const references = messageIds(reply.references || "");
 let id = signedId || enquiryIdFromSubject(reply.subject);
 if (!id) {
  // Closest parent wins; never infer a conversation from subject or sender alone.
  for (const reference of references.slice().reverse()) {
   id = await getRecord<string>("enquiry-message", messageKey(reference));
   if (id) break;
  }
 }
 if (!id) return NextResponse.json({ error: "Reply does not match the enquiry mailbox." }, { status: 400 });
 const enquiry = await getRecord<{ email?: string; createdAt?: string }>("custom-order", id);
 if (!enquiry) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
 const senders = emailAddresses(reply.from);
 const recipients = emailAddresses(reply.to + "," + (reply.cc || ""));
 const customer = enquiry.email?.trim().toLowerCase();
 // A signed original is a routing anchor, not a new conversation entry.
 if (signedId) {
  const configuredSender = emailAddresses(process.env.RESEND_FROM_EMAIL || "hello@clubcrumbie.com");
  if (senders.length !== 1 || !configuredSender.includes(senders[0]) ||
      (!recipients.includes(enquiryMailbox) && (!customer || !recipients.includes(customer))) ||
      (enquiry.createdAt && Date.parse(reply.sentAt) < Date.parse(enquiry.createdAt)) ||
      Date.parse(reply.sentAt) > Date.now() + 300000) {
   return NextResponse.json({ error: "Invalid thread anchor." }, { status: 400 });
  }
  for (const messageId of messageIds(reply.rfcMessageId || "")) {
   await setRecord("enquiry-message", messageKey(messageId), id);
  }
  if (recipients.includes(enquiryMailbox)) {
   await setRecord("gmail-anchor", id, { messageId: reply.messageId, subject: reply.subject });
  }
  return NextResponse.json({ ok: true, anchor: true });
 }
 const outgoing = senders.length === 1 && senders[0] === enquiryMailbox && !!customer && recipients.includes(customer);
 const incoming = senders.length === 1 && senders[0] === customer && recipients.includes(enquiryMailbox);
 if ((!outgoing && !incoming) || (enquiry.createdAt && Date.parse(reply.sentAt) < Date.parse(enquiry.createdAt)) || Date.parse(reply.sentAt) > Date.now() + 300000) {
  return NextResponse.json({ error: "Reply recipient or date does not match." }, { status: 400 });
 }
 for (const messageId of messageIds(reply.rfcMessageId || "")) {
  await setRecord("enquiry-message", messageKey(messageId), id);
 }
 const updated = await appendEnquiryReply(id, { subject: reply.subject, message: reply.message, sentAt: reply.sentAt, source: "gmail", direction: incoming ? "incoming" : "outgoing", externalId: `gmail:${reply.messageId}` });
 return updated ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
}
