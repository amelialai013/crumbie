import "server-only";
import { createClient } from "@vercel/kv";

export const NS = "crumbie:v1";

export const key = (...parts: string[]) => [NS, ...parts].join(":");

const storeUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REST_URL;
const storeToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REST_TOKEN;
const kv = storeUrl && storeToken ? createClient({ url: storeUrl, token: storeToken }) : null;

function isPresent<T>(value: T | null | undefined): value is T {
	return value !== null && value !== undefined;
}

export function storeConfigured() {
	return kv !== null;
}

export async function saveRecord<T extends { id: string }>(kind: string, record: T) {
	if (!kv) throw new Error("Datastore is not configured");
	await kv.set(key(kind, record.id), record);
	await kv.lpush(key(kind, "all"), record.id);
}

export async function listRecords<T>(kind: string): Promise<T[]> {
	if (!kv) return [];
	const ids = await kv.lrange<string>(key(kind, "all"), 0, -1);
	const rows = await Promise.all((ids || []).map((id) => kv.get<T>(key(kind, id))));
	return rows.filter(isPresent);
}

export async function getRecord<T>(kind: string, id: string) {
	if (!kv) return null;
	return kv.get<T>(key(kind, id));
}

export async function setRecord<T>(kind: string, id: string, value: T) {
	if (!kv) throw new Error("Datastore is not configured");
	return kv.set(key(kind, id), value);
}
