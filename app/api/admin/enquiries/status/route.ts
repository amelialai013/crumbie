import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/session";
import { getRecord, setRecord } from "@/lib/store";

const schema = z.object({
	id: z.string().trim().min(1).max(100),
	status: z.enum(["replied", "pending", "new"]),
});

type Enquiry = { id: string; status?: string; repliedAt?: string; readAt?: string };

export async function POST(req: Request) {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const parsed = schema.safeParse(await req.json().catch(() => null));
	if (!parsed.success) return NextResponse.json({ error: "Invalid status." }, { status: 400 });

	const { id, status } = parsed.data;
	const enquiry = await getRecord<Enquiry>("custom-order", id);
	if (!enquiry) return NextResponse.json({ error: "Enquiry not found." }, { status: 404 });

	const updated: Enquiry = {
		...enquiry,
		status: status === "replied" ? "replied" : "pending",
		readAt: status === "new" ? undefined : enquiry.readAt || new Date().toISOString(),
		repliedAt: status === "replied" ? enquiry.repliedAt || new Date().toISOString() : undefined,
	};
	await setRecord("custom-order", id, updated);
	return NextResponse.json(updated);
}
