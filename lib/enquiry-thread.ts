import { createHmac, timingSafeEqual, createHash } from "node:crypto";

function signingKey() {
 const key = process.env.GMAIL_REPLY_SYNC_SECRET?.trim();
 if (!key || key.length < 32) throw new Error("Gmail sync is not configured");
 return key;
}
export function threadToken(id: string) {
 return `${id}.${createHmac("sha256", signingKey()).update(`enquiry:${id}`).digest("hex")}`;
}
export function enquiryFromToken(token: string) {
 if (!/^[0-9a-f-]{36}\.[0-9a-f]{64}$/i.test(token)) return null;
 const id = token.split(".")[0];
 const expected = Buffer.from(threadToken(id));
 const actual = Buffer.from(token);
 return expected.length === actual.length && timingSafeEqual(expected, actual) ? id : null;
}
export function messageIds(value: string) { return value.match(/<[^<>\s]+@[^<>\s]+>/g) || []; }
export function messageKey(id: string) { return createHash("sha256").update(id).digest("hex"); }
