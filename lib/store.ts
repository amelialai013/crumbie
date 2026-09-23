import "server-only";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@vercel/kv";

export const NS = "crumbie:v1";

export const key = (...parts: string[]) => [NS, ...parts].join(":");

const storeUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REST_URL;
const storeToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REST_TOKEN;
const kv = storeUrl && storeToken ? createClient({ url: storeUrl, token: storeToken }) : null;
const localStorePath = path.join(process.cwd(), ".local", "store.json");
type LocalStore = Record<string, unknown>;

async function readLocalStore(): Promise<LocalStore> {
	try {
		return JSON.parse(await readFile(localStorePath, "utf8")) as LocalStore;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
		throw error;
	}
}

async function writeLocalStore(store: LocalStore) {
	await mkdir(path.dirname(localStorePath), { recursive: true });
	const temporaryPath = `${localStorePath}.tmp`;
	await writeFile(temporaryPath, JSON.stringify(store), "utf8");
	await rename(temporaryPath, localStorePath);
}

function localStoreEnabled() {
	return !kv && process.env.NODE_ENV !== "production";
}

function isPresent<T>(value: T | null | undefined): value is T {
	return value !== null && value !== undefined;
}

export function storeConfigured() {
	return kv !== null || localStoreEnabled();
}

export async function saveRecord<T extends { id: string }>(kind: string, record: T) {
	if (!kv) {
		if (!localStoreEnabled()) throw new Error("Datastore is not configured");
		const store = await readLocalStore();
		store[key(kind, record.id)] = record;
		const ids = Array.isArray(store[key(kind, "all")]) ? (store[key(kind, "all")] as string[]) : [];
		store[key(kind, "all")] = [record.id, ...ids.filter((id) => id !== record.id)];
		await writeLocalStore(store);
		return;
	}
	await kv.set(key(kind, record.id), record);
	await kv.lpush(key(kind, "all"), record.id);
}

export async function listRecords<T>(kind: string): Promise<T[]> {
	if (!kv) {
		if (!localStoreEnabled()) return [];
		const store = await readLocalStore();
		const ids = Array.isArray(store[key(kind, "all")]) ? (store[key(kind, "all")] as string[]) : [];
		return ids.map((id) => store[key(kind, id)] as T | undefined).filter(isPresent);
	}
	const ids = await kv.lrange<string>(key(kind, "all"), 0, -1);
	const rows = await Promise.all((ids || []).map((id) => kv.get<T>(key(kind, id))));
	return rows.filter(isPresent);
}

export async function getRecord<T>(kind: string, id: string) {
	if (!kv) {
		if (!localStoreEnabled()) return null;
		const store = await readLocalStore();
		return (store[key(kind, id)] as T | undefined) ?? null;
	}
	return kv.get<T>(key(kind, id));
}

export async function setRecord<T>(kind: string, id: string, value: T) {
	if (!kv) {
		if (!localStoreEnabled()) throw new Error("Datastore is not configured");
		const store = await readLocalStore();
		store[key(kind, id)] = value;
		await writeLocalStore(store);
		return value;
	}
	return kv.set(key(kind, id), value);
}
