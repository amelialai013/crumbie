import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminSession } from "@/lib/session";

export async function POST(req: Request) {
	const { password } = await req.json().catch(() => ({}));
	const expected = process.env.ADMIN_PASSWORD || "";
	const actualBuffer = Buffer.from(String(password || ""));
	const expectedBuffer = Buffer.from(expected);
	const valid =
		Boolean(expected) &&
		actualBuffer.length === expectedBuffer.length &&
		timingSafeEqual(actualBuffer, expectedBuffer);

	if (!valid) return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
	await createAdminSession();
	return NextResponse.json({ ok: true });
}
