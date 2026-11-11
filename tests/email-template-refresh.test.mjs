import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const moduleUrl = code => 'data:text/javascript;base64,' + Buffer.from(code).toString('base64');
const transpile = code => ts.transpileModule(code, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const helpers = moduleUrl(transpile(await readFile(new URL('../lib/email-templates.ts',import.meta.url),'utf8')));
const mail = moduleUrl(transpile(await readFile(new URL('../lib/enquiry-mail.ts',import.meta.url),'utf8')));
const thread = moduleUrl(transpile(await readFile(new URL('../lib/enquiry-thread.ts',import.meta.url),'utf8')));
const store = moduleUrl('export async function getRecord(kind,id){return globalThis.templateTest.records[id] || null;}');
const resend = moduleUrl('export class Resend { emails={send:async payload=>{globalThis.templateTest.sent.push(payload);return {};}}; }');
let source=transpile(await readFile(new URL('../lib/email.ts',import.meta.url),'utf8'));
source=source.replace('import "server-only";','').replace('"resend"',JSON.stringify(resend)).replace('"@/lib/email-templates"',JSON.stringify(helpers)).replace('"@/lib/enquiry-mail"',JSON.stringify(mail)).replace('"@/lib/enquiry-thread"',JSON.stringify(thread)).replace('"@/lib/store"',JSON.stringify(store));
const {sendEnquiryNotification}=await import(moduleUrl(source));
test('each new notification reads the latest saved template, including removed copy',async()=>{
 const previous=process.env.RESEND_API_KEY;
 process.env.RESEND_API_KEY='test-only-no-network';
 process.env.GMAIL_REPLY_SYNC_SECRET='test-secret'.repeat(5);
 globalThis.templateTest={records:{'email templates':{fields:{enquirySubject:'Old subject',enquiryBody:'Old wording {{customerName}}\n{{enquiryType}}'}}},sent:[]};
 const enquiry={id:'6d107334-81b4-4d02-8f62-e122125e0b41',name:'Test Customer',email:'test@example.com',phone:'0400000000',request:'Template verification',enquiryType:'general'};
 try {
  await sendEnquiryNotification(enquiry);
  globalThis.templateTest.records["gmail-headers"] = { version: 2 };
  globalThis.templateTest.records['email templates'].fields={enquirySubject:'Updated {{customerName}}',enquiryBody:'A new enquiry has been submitted through the Club Crumbie enquiry form.\n\nName: {{customerName}}\nEmail: {{customerEmail}}\nPhone: {{customerPhone}}\nEnquiry type: {{enquiryType}}\n\nMessage:\n{{customerMessage}}\n\nClub Crumbie'};
  await sendEnquiryNotification(enquiry);
  const [old,current]=globalThis.templateTest.sent;
  assert.match(old.text,/Old wording/);
  assert.match(old.subject,/\[Crumbie enquiry:/);
  assert.doesNotMatch(current.subject,/\[Crumbie enquiry:/);
  assert.ok(current.headers["X-Crumbie-Enquiry"]);
  assert.match(current.subject,/Updated Test Customer/);
  assert.match(current.text,/through the Club Crumbie enquiry form/);
  assert.match(current.text,/Message:\nTemplate verification/);
  assert.doesNotMatch(current.text,/Old wording|Contact Us|Please reply to the customer directly/);
  assert.equal(current.replyTo,enquiry.email);
 }finally{
  if(previous===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=previous;
  delete globalThis.templateTest;
 }
});
