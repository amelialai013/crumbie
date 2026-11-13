import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const code=await readFile(new URL('../integrations/gmail-reply-sync/Code.gs',import.meta.url),'utf8');
function setup(){
 const props=new Map([['GMAIL_REPLY_SYNC_SECRET','s'.repeat(64)],['ANCHOR_6d107334-81b4-4d02-8f62-e122125e0b41','anchor']]);let sends=0;
 const anchor={getHeader:()=> '6d107334-81b4-4d02-8f62-e122125e0b41.token',getReplyTo:()=> 'customer@example.com',getId:()=> 'anchor',createDraftReply:()=>({getId:()=> 'draft',send:()=>{sends++;return{getId:()=> 'ab123',getDate:()=>new Date(),getSubject:()=> 'Re: Original enquiry'}}})};
 const ctx=vm.createContext({Date,JSON,PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},Session:{getEffectiveUser:()=>({getEmail:()=> 'clubcrumbieadmin@gmail.com'})},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>{}})},ContentService:{MimeType:{JSON:'json'},createTextOutput:x=>({setMimeType:()=>JSON.parse(x)})},Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,s)=>s,base64EncodeWebSafe:s=>s},GmailApp:{getMessageById:()=>anchor,getDraft:()=>{throw Error('missing')}}});vm.runInContext(code,ctx);
 const payload={secret:'s'.repeat(64),id:'6d107334-81b4-4d02-8f62-e122125e0b41',requestId:'12345678-1234-1234-1234-123456789012',to:'customer@example.com',threadToken:'6d107334-81b4-4d02-8f62-e122125e0b41.token',subject:'Hi',text:'Hello',html:'<p>Hello</p>'};
 return {props,payload,anchor,call:p=>ctx.doPost({postData:{contents:JSON.stringify(p)}}),sends:()=>sends};
}
test('sender rejects wrong secret, wrong recipient and mismatched anchor without sending',()=>{
 const s=setup();assert.equal(s.call({...s.payload,secret:'bad'}).ok,false);assert.equal(s.call({...s.payload,to:'other@example.com'}).ok,false);assert.equal(s.call({...s.payload,threadToken:s.payload.id+'.wrong'}).ok,false);assert.equal(s.sends(),0);
});
test('confirmed Gmail receipt is reused and changed payload cannot reuse request ID',()=>{
 const s=setup();const receipt=s.call(s.payload);assert.equal(receipt.ok,true);assert.equal(s.call(s.payload).messageId,receipt.messageId);assert.equal(s.sends(),1);assert.equal(s.call({...s.payload,text:'Different'}).ok,false);assert.equal(s.sends(),1);
});
test('missing prepared draft fails closed instead of sending another reply',()=>{
 const s=setup();s.props.set('SEND_'+s.payload.requestId,JSON.stringify({fingerprint:JSON.stringify([s.payload.id,s.payload.to,s.payload.subject,s.payload.text,s.payload.html]),draftId:'gone'}));assert.equal(s.call(s.payload).ok,false);assert.equal(s.sends(),0);
});
test('display removes only the known outgoing signature and retains customer content and paragraph breaks',async()=>{
 const source=await readFile(new URL('../lib/enquiry-display.ts',import.meta.url),'utf8');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;const {enquiryMessageDisplay}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
 const body='Hi Amelia,\r\n\r\nTesting back.\r\n\r\nThanks, Club Crumbie\r\nClub Crumbie\r\nclubcrumbieadmin@gmail.com\r\nclubcrumbie.com\r\nInstagram <https://instagram.com/clubcrumbie>';
 assert.equal(enquiryMessageDisplay(body,true),'Hi Amelia,\n\nTesting back.\n\nThanks, Club Crumbie');assert.equal(enquiryMessageDisplay(body,false),body.replace(/\r\n/g,'\n'));assert.equal(enquiryMessageDisplay('Club Crumbie is great',true),'Club Crumbie is great');
});
