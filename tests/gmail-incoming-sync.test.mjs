import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ts from 'typescript';

test('bridge imports both directions, excludes drafts, backfills once and retains watermark on failure', async () => {
 const code = await readFile(new URL('../integrations/gmail-reply-sync/Code.gs', import.meta.url), 'utf8');
 const props = new Map([['GMAIL_REPLY_SYNC_SECRET','test'.repeat(16)],['LAST_SUCCESS_MS',String(Date.now())]]);
 const sent = []; const queries = [];
 const message = (id, from, to, draft=false) => ({getHeader:()=>'',getId:()=>id,getFrom:()=>from,getTo:()=>to,getCc:()=>'',isDraft:()=>draft,getSubject:()=>'Re: [Crumbie enquiry: 6d107334-81b4-4d02-8f62-e122125e0b41]',getDate:()=>new Date(Date.now()-7*86400000),getPlainBody:()=> 'Hello'});
 let status = 200;
 const context = vm.createContext({Date,Set,PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},Session:{getEffectiveUser:()=>({getEmail:()=> 'clubcrumbieadmin@gmail.com'})},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},GmailApp:{search:q=>{queries.push(q);return [{getMessages:()=>[message('out','clubcrumbieadmin@gmail.com','customer@example.com'),message('in','customer@example.com','clubcrumbieadmin@gmail.com'),message('draft','clubcrumbieadmin@gmail.com','customer@example.com',true)]}]}},UrlFetchApp:{fetch:(_,options)=>{sent.push(JSON.parse(options.payload));return {getResponseCode:()=>status}}}});
 vm.runInContext(code,context);
 context.syncCrumbieReplies();
 assert.deepEqual(sent.filter(m=>m.messageId).map(m=>m.messageId),['out','in']);
 assert.ok(!queries[0].includes('in:sent'));
 assert.equal(props.get('INCOMING_SYNC_VERSION'),'2');
 context.syncCrumbieReplies();
 assert.equal(sent.filter(m=>m.messageId).length,2);
 props.delete('INCOMING_SYNC_VERSION');
 const watermark=props.get('LAST_SUCCESS_MS'); status=500;
 assert.throws(()=>context.syncCrumbieReplies(),/HTTP 500/);
 assert.equal(props.get('LAST_SUCCESS_MS'),watermark);
 assert.equal(props.has('INCOMING_SYNC_VERSION'),false);
});

test('customer response reopens enquiry, duplicate preserves read state, older backfill preserves latest response',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'crumbie-sync-'));
 try {
  let source=await readFile(new URL('../lib/store.ts',import.meta.url),'utf8');
  source=source.replace('import "server-only";','').replace('import { createClient } from "@vercel/kv";','const createClient = () => null;').replace('path.join(process.cwd(), ".local", "store.json")',JSON.stringify(path.join(dir,'store.json')));
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const store=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
  await store.saveRecord('custom-order',{id:'test',status:'replied',readAt:'2026-11-01T00:00:00Z'});
  const outgoing={subject:'Reply',message:'Hello',sentAt:'2026-11-02T00:00:00Z',externalId:'gmail:out'};
  await store.appendEnquiryReply('test',outgoing);
  const incoming={...outgoing,sentAt:'2026-11-03T00:00:00Z',direction:'incoming',externalId:'gmail:in'};
  let record=await store.appendEnquiryReply('test',incoming);
  assert.equal(record.status,'pending'); assert.equal(record.readAt,undefined); assert.equal(record.repliedAt,outgoing.sentAt);
  await store.saveRecord('custom-order',{...record,readAt:'2026-11-04T00:00:00Z'});
  record=await store.appendEnquiryReply('test',incoming);
  assert.equal(record.readAt,'2026-11-04T00:00:00Z'); assert.equal(record.replies.length,2);
  record=await store.appendEnquiryReply('test',{...incoming,sentAt:'2026-11-01T00:00:00Z',externalId:'gmail:old'});
  assert.equal(record.readAt,'2026-11-04T00:00:00Z'); assert.equal(record.status,'pending');
  record=await store.appendEnquiryReply('test',{...outgoing,sentAt:'2026-11-05T00:00:00Z',externalId:'gmail:new'});
  assert.equal(record.status,'replied'); assert.equal(record.replies.length,4);
 } finally {await rm(dir,{recursive:true,force:true});}
});
