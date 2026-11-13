import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/session";
import { getRecord, listRecords } from "@/lib/store";

export async function GET() {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const [orders, enquiries] = await Promise.all([listRecords("order"), listRecords("custom-order")]);
	const sender = await getRecord("integration", "gmail-sender");
 const threaded = sender ? await Promise.all(enquiries.map(async (value) => {
  const enquiry = value as { id: string };
  const anchor = await getRecord<{ subject: string }>("gmail-anchor", enquiry.id);
  return { ...enquiry, gmailThreaded: true, gmailSubject: anchor?.subject };
 })) : enquiries;
 return NextResponse.json({ orders, enquiries: threaded });
}
