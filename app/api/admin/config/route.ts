import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/session";
import { storeConfigured } from "@/lib/store";

export async function GET() {
	if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	return NextResponse.json({
		store: storeConfigured(),
		stripe: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET),
		resend: Boolean(process.env.RESEND_API_KEY),
		r2: Boolean(process.env.R2_ENDPOINT && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET_NAME && process.env.R2_PUBLIC_URL),
		session: Boolean(process.env.ADMIN_SESSION_SECRET),
	});
}