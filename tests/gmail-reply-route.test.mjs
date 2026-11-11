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
const threadHelpers = asModule(transpile(await readFile(new URL('../lib/enquiry-thread.ts', import.meta.url), 'utf8')));
const {threadToken} = await import(threadHelpers);
const store = asModule(`export async function getRecord(kind,key){return kind === "enquiry-message" ? globalThis.gmailRouteTest.linkedId : globalThis.gmailRouteTest.record;} export async function setRecord(){} export async function appendEnquiryReply(id,reply){globalThis.gmailRouteTest.appended.push({id,reply});return {id};}`);
let source = transpile(await readFile(new URL('../app/api/integrations/gmail/reply/route.ts', import.meta.url), 'utf8'));
source = source.replace('"next/server"', JSON.stringify(asModule('export const NextResponse={json:(value,init)=>Response.json(value,init)};')))
 .replace('"zod"', JSON.stringify(pathToFileURL(require.resolve('zod')).href))
 .replace('"@/lib/enquiry-thread"', JSON.stringify(threadHelpers)).replace('"@/lib/enquiry-mail"', JSON.stringify(helpers)).replace('"@/lib/store"', JSON.stringify(store));
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
 assert.deepEqual(globalThis.gmailRouteTest.appended,[{id,reply:{subject:valid.subject,message:valid.message,sentAt:valid.sentAt,source:'gmail',direction:'outgoing',externalId:'gmail:a0123456'}}]);
});

test('incoming customer replies are recorded as incoming', async () => {
 assert.equal((await call({...valid, from:'Customer <customer@example.com>', to:'clubcrumbieadmin@gmail.com'})).status,200);
 assert.equal(globalThis.gmailRouteTest.appended[0].reply.direction,'incoming');
});
test('incoming replies must address the mailbox and match the customer', async () => {
 assert.equal((await call({...valid,from:'customer@example.com',to:'other@example.com'})).status,400);
 assert.equal((await call({...valid,from:'stranger@example.com',to:'clubcrumbieadmin@gmail.com'})).status,400);
 assert.equal((await call({...valid,from:'customer@example.com',to:'other@example.com',cc:'clubcrumbieadmin@gmail.com'})).status,200);
});

test('signed original registers an invisible anchor without a duplicate reply',async()=>{
 process.env.GMAIL_REPLY_SYNC_SECRET=secret;
 const result=await call({...valid,subject:'A clean subject',from:'hello@clubcrumbie.com',threadToken:threadToken(id),rfcMessageId:'<original@example.com>'});
 assert.equal(result.status,200);
 assert.equal(globalThis.gmailRouteTest.appended.length,0);
});
test('invalid signatures and wrong anchor senders are rejected',async()=>{
 assert.equal((await call({...valid,subject:'Clean',threadToken:id+'.'+'0'.repeat(64)})).status,400);
 assert.equal((await call({...valid,subject:'Clean',from:'customer@example.com',threadToken:threadToken(id)})).status,400);
});
test('clean subject resolves from known reply headers and still validates customer',async()=>{
 await call(); globalThis.gmailRouteTest.appended=[];globalThis.gmailRouteTest.linkedId=id;
 const payload={...valid,subject:'Re: Your enquiry',from:'customer@example.com',to:'clubcrumbieadmin@gmail.com',references:'<original@example.com>'};
 const request=body=>new Request('https://example.test/api/integrations/gmail/reply',{method:'POST',headers:{authorization:`Bearer ${secret}`},body:JSON.stringify(body)});
 assert.equal((await POST(request(payload))).status,200);
 assert.equal(globalThis.gmailRouteTest.appended[0].id,id);
 assert.equal((await POST(request({...payload,from:'other@example.com'}))).status,400);
});
