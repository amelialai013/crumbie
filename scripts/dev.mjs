import env from '@next/env';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import Stripe from 'stripe';
import net from 'node:net';

env.loadEnvConfig(process.cwd(), true);
const args = process.argv.slice(2);
const portIndex = args.findIndex((arg) => arg === '--port' || arg === '-p');
const port = portIndex >= 0 ? args[portIndex + 1] : process.env.PORT || '3000';
const occupied = await new Promise((resolve) => {
  const socket = net.connect({ host: '127.0.0.1', port: Number(port) });
  socket.once('connect', () => { socket.destroy(); resolve(true); });
  socket.once('error', () => resolve(false));
});
if (occupied) {
  console.error(`Port ${port} already has a running preview. Reuse it or choose --port.`);
  process.exit(1);
}
function stopChild(child) {
  if (!child?.pid) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch (error) {
    if (error.code !== 'ESRCH') console.error('Unable to stop preview child process.');
  }
}
let next;
let listener;
let stopping = false;
let restartTimer;
function startNext() {
  if (next || stopping) return;
  const nextEnv = { ...process.env };
  delete nextEnv.STRIPE_WEBHOOK_SECRET;
  delete nextEnv.__NEXT_PROCESSED_ENV;
  next = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', ...args], { stdio: 'inherit', env: nextEnv, detached: true });
  next.on('exit', (code) => { stop(); process.exitCode = code || 0; });
}
function stop() {
  stopping = true;
  clearTimeout(restartTimer);
  stopChild(listener);
  stopChild(next);
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
function connectStripe() {
  if (stopping) return;
  listener = spawn('stripe', ['listen', '--forward-to', `http://localhost:${port}/api/stripe/webhook`, '--events', 'checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed'], {
    detached: true, env: { ...process.env, STRIPE_API_KEY: process.env.STRIPE_SECRET_KEY }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let text = '';
  const receive = (buffer) => {
    text = (text + buffer.toString()).slice(-8000);
    const match = text.match(/whsec_[A-Za-z0-9]+/);
    if (!match) return;
    const file = '.env.local';
    let content = readFileSync(file, 'utf8');
    content = /^STRIPE_WEBHOOK_SECRET=/m.test(content)
      ? content.replace(/^STRIPE_WEBHOOK_SECRET=.*$/m, `STRIPE_WEBHOOK_SECRET=${match[0]}`)
      : `${content.trimEnd()}\nSTRIPE_WEBHOOK_SECRET=${match[0]}\n`;
    writeFileSync(file, content, { mode: 0o600 });
    process.env.STRIPE_WEBHOOK_SECRET = match[0];
    console.log(`Stripe test webhooks connected on port ${port}.`);
    text = '';
    startNext();
  };
  listener.stdout.on('data', receive);
  listener.stderr.on('data', receive);
  listener.on('error', () => {
    console.error('Stripe CLI unavailable. Install the official Stripe CLI to reconnect test webhooks.');
    startNext();
  });
  const currentListener = listener;
  listener.on('exit', () => {
    stopChild(currentListener);
    if (!stopping) {
      console.error('Stripe webhook listener disconnected; retrying in 10 seconds.');
      restartTimer = setTimeout(connectStripe, 10_000);
    }
  });
}
if (!process.env.STRIPE_SECRET_KEY) {
  console.error('Stripe is missing. Set STRIPE_SECRET_KEY in .env.local.');
  startNext();
} else {
  try {
    const sessions = await new Stripe(process.env.STRIPE_SECRET_KEY).checkout.sessions.list({ limit: 1 });
    if (sessions.data[0]?.livemode || /^(sk|rk)_live_/.test(process.env.STRIPE_SECRET_KEY)) {
      console.log('Live Stripe credentials detected; local test listener skipped.');
      startNext();
    } else {
      connectStripe();
      setTimeout(startNext, 15_000).unref();
    }
  } catch {
    console.error('Stripe credential check failed; verify the key and permissions.');
    startNext();
  }
}
