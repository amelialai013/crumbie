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

const r2DevOrigin = /^https:\/\/pub-[a-z0-9]+\.r2\.dev(?=\/)/;

// Serve media from our own domain (proxied by a /media rewrite) so content filters never see r2.dev.
function firstPartyMedia<T>(value: T): T {
	if (typeof value === "string") return value.replace(r2DevOrigin, "/media") as T;
	if (Array.isArray(value)) return value.map(firstPartyMedia) as T;
	if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, firstPartyMedia(v)])) as T;
	return value;
}

export async function listRecords<T>(kind: string): Promise<T[]> {
	if (!kv) {
		if (!localStoreEnabled()) return [];
		const store = await readLocalStore();
		const ids = Array.isArray(store[key(kind, "all")]) ? (store[key(kind, "all")] as string[]) : [];
		return firstPartyMedia(ids.map((id) => store[key(kind, id)] as T | undefined).filter(isPresent));
	}
	const ids = await kv.lrange<string>(key(kind, "all"), 0, -1);
	const rows = await Promise.all((ids || []).map((id) => kv.get<T>(key(kind, id))));
	return firstPartyMedia(rows.filter(isPresent));
}

export async function getRecord<T>(kind: string, id: string) {
	if (!kv) {
		if (!localStoreEnabled()) return null;
		const store = await readLocalStore();
		return firstPartyMedia((store[key(kind, id)] as T | undefined) ?? null);
	}
	return firstPartyMedia(await kv.get<T>(key(kind, id)));
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

export async function deleteRecord(kind: string, id: string) {
	if (!kv) {
		if (!localStoreEnabled()) throw new Error("Datastore is not configured");
		const store = await readLocalStore();
		delete store[key(kind, id)];
		const ids = Array.isArray(store[key(kind, "all")]) ? (store[key(kind, "all")] as string[]) : [];
		store[key(kind, "all")] = ids.filter((item) => item !== id);
		await writeLocalStore(store);
		return;
	}
	await kv.del(key(kind, id));
	await kv.lrem(key(kind, "all"), 0, id);
}

const localFailures = new Map<string, { count: number; resetAt: number }>();

export async function failureCount(bucket: string) {
	if (!kv) {
		const entry = localFailures.get(bucket);
		return entry && entry.resetAt > Date.now() ? entry.count : 0;
	}
	return Number((await kv.get<number>(key("failures", bucket))) ?? 0);
}

export async function recordFailure(bucket: string, windowSeconds: number) {
	if (!kv) {
		const entry = localFailures.get(bucket);
		const live = entry && entry.resetAt > Date.now() ? entry : { count: 0, resetAt: Date.now() + windowSeconds * 1000 };
		live.count += 1;
		localFailures.set(bucket, live);
		return;
	}
	const k = key("failures", bucket);
	if ((await kv.incr(k)) === 1) await kv.expire(k, windowSeconds);
}

export async function clearFailures(bucket: string) {
	if (!kv) {
		localFailures.delete(bucket);
		return;
	}
	await kv.del(key("failures", bucket));
}

// Append in Redis atomically so Gmail retries and portal replies cannot overwrite one another.
export async function appendEnquiryReply(id: string, reply: import("./enquiry-mail").StoredEnquiryReply) {
 if (kv) {
  const script = `
   local raw = redis.call('GET', KEYS[1])
   if not raw then return nil end
   local record = cjson.decode(raw)
   local reply = cjson.decode(ARGV[1])
   record.replies = record.replies or {}
   if reply.externalId then
    for _, existing in ipairs(record.replies) do
     if existing.externalId == reply.externalId then return raw end
    end
   end
   table.insert(record.replies, reply)
   table.sort(record.replies, function(a, b) return a.sentAt < b.sentAt end)
   for _, message in ipairs(record.replies) do
    if message.direction ~= 'incoming' then record.repliedAt = message.sentAt end
   end
   if record.replies[#record.replies].externalId == reply.externalId and reply.direction == 'incoming' then
    record.status = 'pending'
    record.readAt = nil
   elseif record.replies[#record.replies].direction ~= 'incoming' then
    record.status = 'replied'
    record.readAt = record.readAt or reply.sentAt
   end
   local updated = cjson.encode(record)
   redis.call('SET', KEYS[1], updated)
   return updated
  `;
  const result = await kv.eval<[string], string | Record<string, unknown> | null>(script, [key("custom-order", id)], [JSON.stringify(reply)]);
  return typeof result === "string" ? JSON.parse(result) : result;
 }
 if (!localStoreEnabled()) throw new Error("Datastore is not configured");
 return withLocalReplyLock(async () => {
  const store = await readLocalStore();
  const record = store[key("custom-order", id)] as { replies?: import("./enquiry-mail").StoredEnquiryReply[]; [key: string]: unknown } | undefined;
  if (!record) return null;
  if (reply.externalId && record.replies?.some(existing => existing.externalId === reply.externalId)) return record;
  const replies = [...(record.replies || []), reply].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  const latest = replies[replies.length - 1];
  const lastOutgoing = replies.filter(message => message.direction !== "incoming").at(-1);
  const updated: Record<string, unknown> = { ...record, replies, repliedAt: lastOutgoing?.sentAt || record.repliedAt };
  if (latest === reply && reply.direction === "incoming") {
   updated.status = "pending";
   delete updated.readAt;
  } else if (latest.direction !== "incoming") {
   updated.status = "replied";
   updated.readAt = record.readAt || reply.sentAt;
  }
  store[key("custom-order", id)] = updated;
  await writeLocalStore(store);
  return updated;
 });
}

let localReplyQueue: Promise<unknown> = Promise.resolve();
function withLocalReplyLock<T>(run: () => Promise<T>): Promise<T> {
 const result = localReplyQueue.then(run);
 localReplyQueue = result.catch(() => undefined);
 return result;
}
