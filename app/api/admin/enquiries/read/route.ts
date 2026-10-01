import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/session";
import { getRecord, setRecord } from "@/lib/store";

const schema = z.object({ id: z.string().trim().min(1).max(100) });

type Enquiry = { id: string; readAt?: string };

export async function POST(req: Request) {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const parsed = schema.safeParse(await req.json().catch(() => null));
	if (!parsed.success) return NextResponse.json({ error: "Invalid enquiry." }, { status: 400 });

	const enquiry = await getRecord<Enquiry>("custom-order", parsed.data.id);
	if (!enquiry) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });
	if (enquiry.readAt) return NextResponse.json(enquiry);

	const updated: Enquiry = { ...enquiry, readAt: new Date().toISOString() };
	await setRecord("custom-order", parsed.data.id, updated);
	return NextResponse.json(updated);
}
