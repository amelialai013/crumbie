import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/session";
import { getRecord, setRecord } from "@/lib/store";

const schema = z.object({
	id: z.string().trim().min(1).max(100),
	kind: z.enum(["pickup", "delivery"]),
	done: z.boolean(),
});

export async function POST(req: Request) {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const parsed = schema.safeParse(await req.json().catch(() => null));
	if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

	const order = await getRecord<Record<string, unknown>>("order", parsed.data.id);
	if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

	const field = parsed.data.kind === "pickup" ? "pickedUpAt" : "deliveredAt";
	const value = parsed.data.done ? new Date().toISOString() : null;
	await setRecord("order", parsed.data.id, { ...order, [field]: value });
	return NextResponse.json({ id: parsed.data.id, field, value });
}
