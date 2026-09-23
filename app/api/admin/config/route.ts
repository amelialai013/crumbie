import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/session";
import { storeConfigured } from "@/lib/store";
import { r2Configured } from "@/lib/r2";

export async function GET() {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	return NextResponse.json({
		store: storeConfigured(),
		stripe: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
		resend: Boolean(process.env.RESEND_API_KEY),
		openai: Boolean(process.env.OPENAI_API_KEY),
		r2: r2Configured() || process.env.NODE_ENV !== "production",
		session: Boolean(process.env.ADMIN_SESSION_SECRET),
	});
}