import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "crumbie_admin";

function secret() {
	const value = process.env.ADMIN_SESSION_SECRET;
	if (!value || value.length < 32) throw new Error("ADMIN_SESSION_SECRET must be at least 32 characters");
	return new TextEncoder().encode(value);
}

export async function createAdminSession() {
	const token = await new SignJWT({ role: "admin" })
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime("7d")
		.sign(secret());

	(await cookies()).set(COOKIE, token, {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "strict",
		path: "/",
		maxAge: 60 * 60 * 24 * 7,
	});
}

export async function destroyAdminSession() {
	(await cookies()).set(COOKIE, "", {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "strict",
		path: "/",
		maxAge: 0,
	});
}

export async function isAdmin() {
	try {
		const token = (await cookies()).get(COOKIE)?.value;
		if (!token) return false;
		const { payload } = await jwtVerify(token, secret());
		return payload.role === "admin";
	} catch {
		return false;
	}
}
