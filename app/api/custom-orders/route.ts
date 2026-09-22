import { NextResponse } from "next/server";
import { z } from "zod";
import { sendEnquiryNotification } from "@/lib/email";
import { saveRecord } from "@/lib/store";

const schema = z.object({
	name: z.string().trim().min(1).max(100),
	email: z.string().email().max(200),
	phone: z.string().trim().min(6).max(40).regex(/^[+()0-9\s-]+$/, "Invalid phone number"),
	enquiryType: z.enum(["general", "custom-order"]),
	request: z.string().trim().min(10).max(3000),
});

export async function POST(req: Request) {
	const parsed = schema.safeParse(await req.json().catch(() => null));
	if (!parsed.success) return NextResponse.json({ error: "Please check the form." }, { status: 400 });

	const record = {
		id: crypto.randomUUID(),
		...parsed.data,
		status: "pending",
		createdAt: new Date().toISOString(),
	};

	try {
		await saveRecord("custom-order", record);
	} catch {
		return NextResponse.json({ error: "Service is not configured." }, { status: 503 });
	}

	try {
		await sendEnquiryNotification(record);
	} catch (error) {
		console.error("Unable to send enquiry notification", error);
	}

	return NextResponse.json({ ok: true }, { status: 201 });
}
