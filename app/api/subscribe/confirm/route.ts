import { NextResponse } from "next/server";
import { newsletterClient, newsletterSegmentId, validConfirmToken } from "@/lib/newsletter";
import { setRecord } from "@/lib/store";
import { siteUrl } from "@/lib/site";

export async function GET(req: Request) {
	const params = new URL(req.url).searchParams;
	const email = (params.get("email") || "").trim().toLowerCase();
	const token = params.get("token") || "";
	const done = (state: string) => NextResponse.redirect(`${siteUrl}/newsletter/confirmed?status=${state}`);
	if (!email || !token || !validConfirmToken(email, token)) return done("invalid");
	try {
		const resend = newsletterClient();
		const { error } = await resend.contacts.update({ email, unsubscribed: false });
		if (error) throw new Error(error.message);
		await setRecord("newsletter-confirmed", email, true).catch(() => null);
		const segmentId = await newsletterSegmentId(resend);
		await resend.contacts.segments.add({ email, segmentId }).catch(() => null);
	} catch (error) {
		console.error("Unable to confirm subscription", error);
		return done("error");
	}
	return done("ok");
}
