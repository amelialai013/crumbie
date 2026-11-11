import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { emailAddresses, enquiryIdFromSubject, enquiryMailbox } from "@/lib/enquiry-mail";
import { appendEnquiryReply, getRecord } from "@/lib/store";

const schema = z.object({
 messageId: z.string().regex(/^[a-zA-Z0-9_-]{1,200}$/),
 subject: z.string().max(500),
 from: z.string().max(500),
 to: z.string().max(2000),
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
 const parsed = schema.safeParse(json);
 if (!parsed.success) return NextResponse.json({ error: "Invalid reply." }, { status: 400 });
 const reply = parsed.data;
 const id = enquiryIdFromSubject(reply.subject);
 if (!id || !emailAddresses(reply.from).includes(enquiryMailbox)) return NextResponse.json({ error: "Reply does not match the enquiry mailbox." }, { status: 400 });
 const enquiry = await getRecord<{ email?: string; createdAt?: string }>("custom-order", id);
 if (!enquiry) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
 if (!enquiry.email || !emailAddresses(reply.to).includes(enquiry.email.toLowerCase()) || (enquiry.createdAt && Date.parse(reply.sentAt) < Date.parse(enquiry.createdAt)) || Date.parse(reply.sentAt) > Date.now() + 300000) {
  return NextResponse.json({ error: "Reply recipient or date does not match." }, { status: 400 });
 }
 const updated = await appendEnquiryReply(id, { subject: reply.subject, message: reply.message, sentAt: reply.sentAt, source: "gmail", externalId: `gmail:${reply.messageId}` });
 return updated ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
}
