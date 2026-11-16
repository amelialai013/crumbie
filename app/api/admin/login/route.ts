import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminSession } from "@/lib/session";
import { clearFailures, failureCount, recordFailure } from "@/lib/store";

const MAX_FAILURES = 5;
const WINDOW_SECONDS = 15 * 60;
const digest = (value: string) => createHash("sha256").update(value).digest();

export async function POST(req: Request) {
	const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
	const buckets = [`login:ip:${ip}`, "login:all"];

	try {
		const [perIp, global] = await Promise.all(buckets.map(failureCount));
		if (perIp >= MAX_FAILURES || global >= MAX_FAILURES * 10) {
			return NextResponse.json(
				{ error: "Too many attempts. Try again in 15 minutes." },
				{ status: 429, headers: { "Retry-After": String(WINDOW_SECONDS) } },
			);
		}
	} catch (error) {
		console.error("Login rate limit check failed", error);
	}

	const { password } = await req.json().catch(() => ({}));
	const expected = process.env.ADMIN_PASSWORD || "";
	// Hash both sides so the comparison does not reveal the password length.
	const valid = Boolean(expected) && timingSafeEqual(digest(String(password || "")), digest(expected));

	if (!valid) {
		await Promise.all(buckets.map((bucket) => recordFailure(bucket, WINDOW_SECONDS))).catch(() => undefined);
		return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
	}
	try {
		await createAdminSession();
	} catch (error) {
		console.error("Admin session setup failed", error);
		return NextResponse.json(
			{ error: "Admin session is not configured." },
			{ status: 503 },
		);
	}
	await clearFailures(buckets[0]).catch(() => undefined);
	return NextResponse.json({ ok: true });
}
