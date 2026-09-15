import"server-only";import{kv}from"@vercel/kv";
export const NS="crumbie:v1";export const key=(...parts:string[])=>[NS,...parts].join(":");
export function storeConfigured(){return Boolean(process.env.KV_REST_API_URL&&process.env.KV_REST_API_TOKEN)}
export async function saveRecord<T extends{id:string}>(kind:string,record:T){if(!storeConfigured())throw new Error("Datastore is not configured");await kv.set(key(kind,record.id),record);await kv.lpush(key(kind,"all"),record.id)}
export async function listRecords<T>(kind:string):Promise<T[]>{if(!storeConfigured())return[];const ids=await kv.lrange<string>(key(kind,"all"),0,-1);const rows=await Promise.all((ids||[]).map(id=>kv.get<T>(key(kind,id))));return rows.filter(Boolean)as T[]}
export async function getRecord<T>(kind:string,id:string){if(!storeConfigured())return null;return kv.get<T>(key(kind,id))}
export async function setRecord<T>(kind:string,id:string,value:T){if(!storeConfigured())throw new Error("Datastore is not configured");return kv.set(key(kind,id),value)}
