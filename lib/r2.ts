import "server-only";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import pathModule from "node:path";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export function r2Configured() {
	return Boolean(
		process.env.R2_ENDPOINT &&
			process.env.R2_ACCESS_KEY_ID &&
			process.env.R2_SECRET_ACCESS_KEY &&
			process.env.R2_BUCKET_NAME &&
			process.env.R2_PUBLIC_URL,
	);
}

function client() {
	return new S3Client({
		region: "auto",
		endpoint: process.env.R2_ENDPOINT,
		credentials: {
			accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
			secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
		},
	});
}

export async function uploadMedia(path: string, bytes: Uint8Array, contentType: string) {
	const safePath = `crumbie/${path.replace(/[^a-zA-Z0-9._/-]/g, "_")}`;
	if (!r2Configured() && process.env.NODE_ENV !== "production") {
		const localPath = globalThis.process.cwd() + "/public/uploads/" + safePath;
		await mkdir(pathModule.dirname(localPath), { recursive: true });
		await writeFile(localPath, bytes);
		return `/uploads/${safePath}`;
	}
	const bucket = process.env.R2_BUCKET_NAME;
	const base = process.env.R2_PUBLIC_URL;
	if (!bucket || !base) throw new Error("R2 is not configured");

	await client().send(new PutObjectCommand({ Bucket: bucket, Key: safePath, Body: bytes, ContentType: contentType }));
	return `${base.replace(/\/$/, "")}/${safePath}`;
}

export async function deleteMedia(path: string) {
	if (!r2Configured() && process.env.NODE_ENV !== "production") {
		await unlink(pathModule.join(process.cwd(), "public", path)).catch(() => undefined);
		return;
	}
	const bucket = process.env.R2_BUCKET_NAME;
	if (!bucket) throw new Error("R2 is not configured");
	if (!path.startsWith("crumbie/")) throw new Error("Refusing to delete media outside Crumbie namespace");
	await client().send(new DeleteObjectCommand({ Bucket: bucket, Key: path }));
}
