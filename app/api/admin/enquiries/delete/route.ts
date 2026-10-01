import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/session";
import { deleteRecord, getRecord } from "@/lib/store";

const schema = z.object({ id: z.string().trim().min(1).max(100) });

export async function POST(req: Request) {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const parsed = schema.safeParse(await req.json().catch(() => null));
	if (!parsed.success) return NextResponse.json({ error: "Invalid enquiry." }, { status: 400 });

	const enquiry = await getRecord("custom-order", parsed.data.id);
	if (!enquiry) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });

	await deleteRecord("custom-order", parsed.data.id);
	return NextResponse.json({ id: parsed.data.id });
}
