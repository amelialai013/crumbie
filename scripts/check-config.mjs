import env from '@next/env';
import Stripe from 'stripe';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
env.loadEnvConfig(process.cwd(), true);
let failed = false;
async function check(name, run) {
  try { const result = await run(); console.log(`${name}: ${result}`); }
  catch { failed = true; console.error(`${name}: unavailable or incomplete configuration`); }
}
await check('Store', async () => {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REST_TOKEN;
  if (!url || !token) throw new Error();
  const response = await fetch(`${url}/ping`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok || (await response.json()).result !== 'PONG') throw new Error();
  return 'connected';
});
await check('Stripe', async () => {
  const sessions = await new Stripe(process.env.STRIPE_SECRET_KEY).checkout.sessions.list({ limit: 1 });
  if (!process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')) throw new Error();
  return sessions.data[0]?.livemode ? 'connected (live)' : 'connected (test; npm run dev reconnects webhooks)';
});
await check('Resend', async () => {
  const response = await fetch('https://api.resend.com/domains', { headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` }, signal: AbortSignal.timeout(10_000) });
  const result = await response.json();
  if (!response.ok || !result.data?.some((domain) => domain.name === 'clubcrumbie.com' && domain.status === 'verified')) throw new Error();
  return 'connected; clubcrumbie.com verified';
});
await check('OpenAI', async () => {
  const response = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, signal: AbortSignal.timeout(10_000) });
  const result = await response.json();
  if (!response.ok || !result.data?.some((model) => model.id === 'gpt-image-2.5-sunburst')) throw new Error();
  return 'connected; cookie image model available';
});
await check('R2', async () => {
  for (const key of ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_PUBLIC_URL']) if (!process.env[key]) throw new Error();
  const client = new S3Client({ region: 'auto', endpoint: process.env.R2_ENDPOINT, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY } });
  await client.send(new HeadBucketCommand({ Bucket: process.env.R2_BUCKET_NAME }));
  return 'connected';
});
await check('Session', async () => {
  if (!process.env.ADMIN_PASSWORD || (process.env.ADMIN_SESSION_SECRET?.length || 0) < 32) throw new Error();
  return 'persistent admin credentials configured';
});
process.exitCode = failed ? 1 : 0;
