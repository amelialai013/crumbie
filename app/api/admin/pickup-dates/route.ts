import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/session";
import { type PickupDate } from "@/lib/catalog";
import { saveRecord } from "@/lib/store";

import { getPickupDates } from "@/lib/catalog-store";

function validDate(value: unknown): value is string {
	return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime());
}

export async function GET() {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	return NextResponse.json(await getPickupDates());
}

export async function DELETE(request: Request) {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const id = new URL(request.url).searchParams.get("id");
	if (!id) return NextResponse.json({ error: "Pickup date id is required" }, { status: 400 });
	try {
		await saveRecord("pickup-date", { id, date: "", window: "", removed: true });
		return NextResponse.json({ ok: true });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unable to remove pickup date";
		return NextResponse.json({ error: message }, { status: 503 });
	}
}

export async function POST(request: Request) {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const payload = await request.json().catch(() => null);
	if (!payload || !validDate(payload.date) || typeof payload.window !== "string" || !payload.window.trim() || payload.window.length > 80) {
		return NextResponse.json({ error: "Enter a valid date and pickup window" }, { status: 400 });
	}
	const record: PickupDate = { id: `pickup-${payload.date}`, date: payload.date, window: payload.window.trim() };
	try {
		await saveRecord("pickup-date", record);
		return NextResponse.json(record, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unable to save pickup date";
		return NextResponse.json({ error: message }, { status: 503 });
	}
}
