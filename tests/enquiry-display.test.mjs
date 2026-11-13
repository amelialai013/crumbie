import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const source=await readFile(new URL('../lib/enquiry-display.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {enquiryMessageDisplay:display}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('customer reply and sign-off remain visible while trailing quoted MIME/history collapses',()=>{
 const reply='Testing on my mobile.\n\nThanks,\nAmelia';
 assert.equal(display(reply+'\n\n> On 14 Nov 2026, Club Crumbie wrote:\n>\n> --000083244\n> Content-Type: text/plain\n> Old reply',false),reply);
});
test('Gmail and Apple Mail attribution headers collapse with the old conversation',()=>{
 assert.equal(display('New reply\n\nOn Sat, 14 Nov 2026 at 07:42, Club Crumbie\n<clubcrumbieadmin@gmail.com> wrote:\n\nOld reply',false),'New reply');
});
test('Outlook full header blocks collapse without treating ordinary From text as a boundary',()=>{
 assert.equal(display('New reply\n\nFrom: Club Crumbie\nSent: Saturday\nTo: Amelia\nSubject: Enquiry\nOld reply',false),'New reply');
 assert.equal(display('From: my kitchen\nHere is the answer',false),'From: my kitchen\nHere is the answer');
});
test('inline answers and quote-only emails are preserved',()=>{
 const inline='Hi\n> How many?\nTwelve, please.';assert.equal(display(inline,false),inline);
 assert.equal(display('> Just a quoted message',false),'> Just a quoted message');
});
