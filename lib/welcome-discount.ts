import "server-only";
import { randomBytes } from "node:crypto";
import Stripe from "stripe";

const validDays = 30;
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export type WelcomeCode = { code: string; expiresAt: Date; label: string };
export type WelcomeDiscountSettings = { enabled?: string; type?: string; value?: string };

function parseDiscount(settings: WelcomeDiscountSettings) {
	if ((settings.enabled ?? "true") === "false") return null;
	const value = Number(settings.value ?? "10");
	if (!Number.isFinite(value) || value <= 0) return null;
	if (settings.type === "amount") {
		const cents = Math.round(value * 100);
		return { id: `welcome-aud-${cents}`, label: `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`, params: { amount_off: cents, currency: "aud" } };
	}
	const percent = Math.min(100, Math.round(value * 100) / 100);
	return { id: `welcome-pct-${percent}`, label: `${percent}%`, params: { percent_off: percent } };
}

// One single-use, expiring code per subscriber so it can't be shared.
export async function createWelcomeCode(settings: WelcomeDiscountSettings): Promise<WelcomeCode | null> {
	const discount = parseDiscount(settings);
	if (!discount) return null;
	const key = process.env.STRIPE_SECRET_KEY?.trim();
	if (!key) return null;
	const stripe = new Stripe(key);
	try {
		await stripe.coupons.retrieve(discount.id);
	} catch {
		await stripe.coupons.create({ id: discount.id, ...discount.params, duration: "once", name: `Welcome ${discount.label} off` });
	}
	const expiresAt = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000);
	const suffix = Array.from(randomBytes(6), (byte) => alphabet[byte % alphabet.length]).join("");
	const code = `CRUMBIE-${suffix}`;
	await stripe.promotionCodes.create({
		promotion: { type: "coupon", coupon: discount.id },
		code,
		max_redemptions: 1,
		expires_at: Math.floor(expiresAt.getTime() / 1000),
	});
	return { code, expiresAt, label: discount.label };
}
