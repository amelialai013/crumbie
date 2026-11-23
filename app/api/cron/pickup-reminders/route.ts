import { NextResponse } from "next/server";
import { sendPickupReminder } from "@/lib/email";
import { listRecords, setRecord } from "@/lib/store";

export const dynamic = "force-dynamic";

const REMINDER_LEAD_MS = 48 * 60 * 60 * 1000;

type Line = { pickupDate?: string; pickupWindow?: string; fulfilment?: "pickup" | "delivery" };
type Order = {
	id: string;
	customer: { name: string; email: string };
	lines: Line[];
	card?: null;
	currency: string | null;
	amountTotal: number | null;
	fulfilment?: "pickup" | "delivery";
	paymentStatus?: string;
	pickupRemindersSent?: string[];
};

function melbourneOffset(date: string) {
	const part = new Intl.DateTimeFormat("en-AU", { timeZone: "Australia/Melbourne", timeZoneName: "longOffset" })
		.formatToParts(new Date(`${date}T12:00:00Z`))
		.find((item) => item.type === "timeZoneName")?.value;
	const match = part?.match(/([+-]\d{2}):(\d{2})/);
	return match ? `${match[1]}:${match[2]}` : "+10:00";
}

function windowStart(date: string, window: string) {
	const match = window.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
	if (!match) return null;
	let hour = Number(match[1]) % 12;
	if (match[3].toLowerCase() === "pm") hour += 12;
	const time = new Date(`${date}T${String(hour).padStart(2, "0")}:${match[2] ?? "00"}:00${melbourneOffset(date)}`).getTime();
	return Number.isNaN(time) ? null : time;
}

export async function GET(req: Request) {
	const secret = process.env.CRON_SECRET;
	if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	const now = Date.now();
	const orders = await listRecords<Order>("order");
	let sent = 0;
	let failed = 0;

	for (const order of orders) {
		if (order.paymentStatus && order.paymentStatus !== "paid") continue;
		const done = new Set(order.pickupRemindersSent ?? []);
		const slots = new Map<string, { date: string; window: string }>();
		for (const line of order.lines ?? []) {
			if ((line.fulfilment ?? order.fulfilment ?? "pickup") === "delivery") continue;
			if (line.pickupDate && line.pickupWindow) slots.set(`${line.pickupDate}|${line.pickupWindow}`, { date: line.pickupDate, window: line.pickupWindow });
		}
		const sentNow: string[] = [];
		for (const [slotKey, slot] of slots) {
			if (done.has(slotKey)) continue;
			const start = windowStart(slot.date, slot.window);
			if (start === null || start <= now || start - now > REMINDER_LEAD_MS) continue;
			try {
				await sendPickupReminder(order, slot);
				sentNow.push(slotKey);
				sent += 1;
			} catch (error) {
				failed += 1;
				console.error("Pickup reminder failed", order.id, error);
			}
		}
		if (sentNow.length) await setRecord("order", order.id, { ...order, pickupRemindersSent: [...done, ...sentNow] });
	}

	return NextResponse.json({ sent, failed });
}
