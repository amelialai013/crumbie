import { NextResponse } from "next/server";
import { newsletterClient, newsletterSegmentId } from "@/lib/newsletter";
import { deleteRecord, getRecord, setRecord } from "@/lib/store";
import { isAdmin } from "@/lib/session";

export async function GET() {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	try {
		const resend = newsletterClient();
		const segmentId = await newsletterSegmentId(resend);
		const subscribers: { id: string; email: string; name: string; subscribedAt: string; unsubscribed: boolean; pending: boolean }[] = [];
		let after: string | undefined;
		for (let page = 0; page < 50; page += 1) {
			const { data } = await resend.contacts.list({ segmentId, limit: 100, ...(after ? { after } : {}) });
			if (!data) break;
			for (const contact of data.data) {
				subscribers.push({
					id: contact.id,
					email: contact.email,
					name: [contact.first_name, contact.last_name].filter(Boolean).join(" "),
					subscribedAt: contact.created_at,
					unsubscribed: Boolean(contact.unsubscribed),
					pending: false,
				});
			}
			if (!data.has_more || !data.data.length) break;
			after = data.data[data.data.length - 1].id;
		}
		// Contacts only reach "confirmed" via the confirm link (or admin action); an unsubscribed contact with no marker never confirmed.
		await Promise.all(
			subscribers.map(async (s) => {
				const email = s.email.toLowerCase();
				if (!s.unsubscribed) {
					if (!(await getRecord("newsletter-confirmed", email).catch(() => true))) await setRecord("newsletter-confirmed", email, true).catch(() => null);
					return;
				}
				s.pending = !(await getRecord("newsletter-confirmed", email).catch(() => true));
			}),
		);
		subscribers.sort((a, b) => b.subscribedAt.localeCompare(a.subscribedAt));
		return NextResponse.json({ subscribers });
	} catch (error) {
		console.error("Unable to load subscribers", error);
		return NextResponse.json({ error: "Unable to load subscribers." }, { status: 502 });
	}
}

export async function PATCH(request: Request) {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const { id, unsubscribed, email } = (await request.json().catch(() => ({}))) as { id?: string; unsubscribed?: boolean; email?: string };
	if (!id || typeof unsubscribed !== "boolean") return NextResponse.json({ error: "Invalid request." }, { status: 400 });
	const { error } = await newsletterClient().contacts.update({ id, unsubscribed });
	if (error) return NextResponse.json({ error: "Unable to update subscriber." }, { status: 502 });
	if (email) await setRecord("newsletter-confirmed", email.toLowerCase(), true).catch(() => null);
	return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const { id, email } = (await request.json().catch(() => ({}))) as { id?: string; email?: string };
	if (!id) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
	const { error } = await newsletterClient().contacts.remove({ id });
	if (error) return NextResponse.json({ error: "Unable to delete subscriber." }, { status: 502 });
	if (email) await deleteRecord("newsletter-confirmed", email.toLowerCase()).catch(() => null);
	return NextResponse.json({ ok: true });
}
