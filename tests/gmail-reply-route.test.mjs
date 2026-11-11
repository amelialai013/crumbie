import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const asModule = source => 'data:text/javascript;base64,' + Buffer.from(source).toString('base64');
const transpile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const helpers = asModule(transpile(await readFile(new URL('../lib/enquiry-mail.ts', import.meta.url), 'utf8')));
const store = asModule(`export async function getRecord(){return globalThis.gmailRouteTest.record;} export async function appendEnquiryReply(id,reply){globalThis.gmailRouteTest.appended.push({id,reply});return {id};}`);
let source = transpile(await readFile(new URL('../app/api/integrations/gmail/reply/route.ts', import.meta.url), 'utf8'));
source = source.replace('"next/server"', JSON.stringify(asModule('export const NextResponse={json:(value,init)=>Response.json(value,init)};')))
 .replace('"zod"', JSON.stringify(pathToFileURL(require.resolve('zod')).href))
 .replace('"@/lib/enquiry-mail"', JSON.stringify(helpers)).replace('"@/lib/store"', JSON.stringify(store));
const { POST } = await import(asModule(source));
const id='6d107334-81b4-4d02-8f62-e122125e0b41';
const secret='test-only-secret-'.repeat(4);
const valid={messageId:'a0123456',subject:`Re: [Crumbie enquiry: ${id}] Hello`,from:'Club Crumbie <clubcrumbieadmin@gmail.com>',to:'Customer <customer@example.com>',message:'Thanks for your enquiry!',sentAt:new Date().toISOString()};
async function call(payload=valid,auth=`Bearer ${secret}`){
 process.env.GMAIL_REPLY_SYNC_SECRET=secret;
 globalThis.gmailRouteTest={record:{email:'customer@example.com',createdAt:'2026-01-01T00:00:00.000Z'},appended:[]};
 return POST(new Request('https://example.test/api/integrations/gmail/reply',{method:'POST',headers:{authorization:auth},body:JSON.stringify(payload)}));
}
test('unauthenticated messages cannot write portal replies',async()=>{
 assert.equal((await call(valid,'Bearer wrong')).status,401);
 assert.equal(globalThis.gmailRouteTest.appended.length,0);
});
test('mail to a different customer is rejected',async()=>{
 assert.equal((await call({...valid,to:'other@example.com'})).status,400);
 assert.equal(globalThis.gmailRouteTest.appended.length,0);
});
test('mail from another sender is rejected',async()=>{
 assert.equal((await call({...valid,from:'attacker@example.com'})).status,400);
});
test('unrelated subjects and future dates are rejected',async()=>{
 assert.equal((await call({...valid,subject:'Hello'})).status,400);
 assert.equal((await call({...valid,sentAt:'2099-01-01T00:00:00.000Z'})).status,400);
});
test('valid customer reply is recorded with the Gmail deduplication key',async()=>{
 assert.equal((await call()).status,200);
 assert.deepEqual(globalThis.gmailRouteTest.appended,[{id,reply:{subject:valid.subject,message:valid.message,sentAt:valid.sentAt,source:'gmail',externalId:'gmail:a0123456'}}]);
});
