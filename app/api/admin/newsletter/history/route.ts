import { NextResponse } from "next/server";
import { newsletterClient, newsletterSegmentId } from "@/lib/newsletter";
import { isAdmin } from "@/lib/session";

export async function GET(req: Request) {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const id = new URL(req.url).searchParams.get("id");
	try {
		const resend = newsletterClient();
		if (id) {
			const { data, error } = await resend.broadcasts.get(id);
			if (error || !data) throw new Error(error?.message || "Not found");
			return NextResponse.json({
				subject: data.subject || data.name || "",
				html: (data.html || "").replace("{{{RESEND_UNSUBSCRIBE_URL}}}", "#"),
			});
		}
		const segmentId = await newsletterSegmentId(resend);
		const items: { id: string; name: string | null; status: string; createdAt: string; scheduledAt: string | null; sentAt: string | null }[] = [];
		let after: string | undefined;
		for (let page = 0; page < 10; page += 1) {
			const { data } = await resend.broadcasts.list({ limit: 100, ...(after ? { after } : {}) });
			if (!data) break;
			for (const b of data.data) {
				if (b.segment_id && b.segment_id !== segmentId) continue;
				items.push({ id: b.id, name: b.name, status: b.status, createdAt: b.created_at, scheduledAt: b.scheduled_at, sentAt: b.sent_at });
			}
			if (!data.has_more || !data.data.length) break;
			after = data.data[data.data.length - 1].id;
		}
		items.sort((a, b) => (b.sentAt || b.scheduledAt || b.createdAt).localeCompare(a.sentAt || a.scheduledAt || a.createdAt));
		return NextResponse.json({ newsletters: items });
	} catch (error) {
		console.error("Unable to load newsletters", error);
		return NextResponse.json({ error: "Unable to load newsletters." }, { status: 502 });
	}
}
