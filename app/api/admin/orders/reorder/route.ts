import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdmin } from "@/lib/session";
import { getRecord, setRecord } from "@/lib/store";

const schema = z.object({
	ids: z.array(z.string().trim().min(1).max(100)).min(1).max(200),
});

export async function POST(req: Request) {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const parsed = schema.safeParse(await req.json().catch(() => null));
	if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

	await Promise.all(
		parsed.data.ids.map(async (id, index) => {
			const order = await getRecord<Record<string, unknown>>("order", id);
			if (order) await setRecord("order", id, { ...order, stopOrder: index });
		}),
	);
	return NextResponse.json({ ids: parsed.data.ids });
}
