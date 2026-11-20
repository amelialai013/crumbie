import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/session";
import { type PickupDate } from "@/lib/catalog";
import { saveRecord } from "@/lib/store";

import { getDeliveryDates } from "@/lib/catalog-store";

function validDate(value: unknown): value is string {
	return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime());
}

function minutesFromTime(value: string) {
	const match = /^(1[0-2]|[1-9]):([0-5]\d)(am|pm)$/.exec(value);
	if (!match) return null;
	const hours = (Number(match[1]) % 12) + (match[3] === "pm" ? 12 : 0);
	return hours * 60 + Number(match[2]);
}

function validWindow(value: unknown): value is string {
	if (typeof value !== "string") return false;
	const [start, end, ...rest] = value.trim().split("–");
	if (!start || !end || rest.length) return false;
	const startMinutes = minutesFromTime(start);
	const endMinutes = minutesFromTime(end);
	return startMinutes !== null && endMinutes !== null && endMinutes > startMinutes;
}

export async function GET() {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	return NextResponse.json(await getDeliveryDates());
}

export async function DELETE(request: Request) {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const id = new URL(request.url).searchParams.get("id");
	if (!id) return NextResponse.json({ error: "Delivery window id is required" }, { status: 400 });
	try {
		await saveRecord("delivery-date", { id, date: "", window: "", removed: true });
		return NextResponse.json({ ok: true });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unable to remove delivery window";
		return NextResponse.json({ error: message }, { status: 503 });
	}
}

export async function POST(request: Request) {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const payload = await request.json().catch(() => null);
	if (!payload || !validDate(payload.date) || !validWindow(payload.window)) {
		return NextResponse.json({ error: "Enter a valid date and delivery window" }, { status: 400 });
	}
	const existing = await getDeliveryDates();
	if (existing.some((date) => date.date === payload.date)) {
		return NextResponse.json({ error: "That delivery window already exists." }, { status: 409 });
	}
	const record: PickupDate = { id: `delivery-${payload.date}`, date: payload.date, window: payload.window.trim() };
	try {
		await saveRecord("delivery-date", record);
		return NextResponse.json(record, { status: 201 });
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unable to save delivery window";
		return NextResponse.json({ error: message }, { status: 503 });
	}
}
