import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { deleteRecord, getRecord, listRecords, saveRecord, setRecord } from "@/lib/store";
import { isAdmin } from "@/lib/session";

type Draft = { id: string; subject: string; body: string; buttonLabel: string; buttonUrl: string; images?: { src: string; after: number }[]; scheduledAt: string; updatedAt: string };

// The store serves media as /media/... paths; keep absolute URLs so thumbnails and emails resolve.
const absoluteMedia = (src: string) => (src.startsWith("/media/") ? `${(process.env.R2_PUBLIC_URL || "https://pub-fea5209176ba412da081e64534c01cc7.r2.dev").replace(/\/$/, "")}${src.slice(6)}` : src);

const text = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");

export async function GET() {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	try {
		const drafts = await listRecords<Draft>("newsletter-draft");
		for (const d of drafts) d.images = d.images?.map((i) => ({ ...i, src: absoluteMedia(i.src) }));
		drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
		return NextResponse.json({ drafts });
	} catch {
		return NextResponse.json({ error: "Unable to load drafts." }, { status: 503 });
	}
}

export async function POST(req: Request) {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const payload = await req.json().catch(() => null);
	if (!payload || typeof payload !== "object") return NextResponse.json({ error: "Invalid draft." }, { status: 400 });
	const existingId = typeof payload.id === "string" && /^[\w-]{1,64}$/.test(payload.id) ? payload.id : "";
	const draft: Draft = {
		id: existingId || randomUUID(),
		subject: text(payload.subject, 200),
		body: text(payload.body, 10000),
		buttonLabel: text(payload.buttonLabel, 60),
		buttonUrl: text(payload.buttonUrl, 300),
		images: Array.isArray(payload.images) ? payload.images.filter((u: { src?: unknown; after?: unknown }) => u && typeof u.src === "string" && Number.isInteger(u.after)).slice(0, 6).map((u: { src: string; after: number }) => ({ src: absoluteMedia(u.src).slice(0, 500), after: u.after })) : [],
		scheduledAt: text(payload.scheduledAt, 40),
		updatedAt: new Date().toISOString(),
	};
	if (!draft.subject.trim() && !draft.body.trim()) return NextResponse.json({ error: "Add a subject or message to save a draft." }, { status: 400 });
	try {
		if (existingId && (await getRecord<Draft>("newsletter-draft", existingId))) await setRecord("newsletter-draft", existingId, draft);
		else await saveRecord("newsletter-draft", draft);
		return NextResponse.json({ draft });
	} catch {
		return NextResponse.json({ error: "Unable to save draft." }, { status: 503 });
	}
}

export async function DELETE(req: Request) {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const id = new URL(req.url).searchParams.get("id") || "";
	if (!/^[\w-]{1,64}$/.test(id)) return NextResponse.json({ error: "Invalid draft." }, { status: 400 });
	try {
		await deleteRecord("newsletter-draft", id);
		return NextResponse.json({ ok: true });
	} catch {
		return NextResponse.json({ error: "Unable to delete draft." }, { status: 503 });
	}
}
