import assert from 'node:assert/strict';
import test from 'node:test';
import { enquiryIdFromSubject, enquiryReference, notificationRecipients, emailAddresses } from '../lib/enquiry-mail.ts';
const id = '6d107334-81b4-4d02-8f62-e122125e0b41';
test('normal Gmail reply subjects retain the exact enquiry ID', () => {
 assert.equal(enquiryIdFromSubject(`Re: ${enquiryReference(id)} Customer question`), id);
 assert.equal(enquiryIdFromSubject('Re: Customer question'), null);
 assert.equal(enquiryIdFromSubject('[Crumbie enquiry: arbitrary-key]'), null);
});
test('Gmail is always included alongside existing recipients without duplicates', () => {
 assert.deepEqual(notificationRecipients('clubcrumbieadmin@gmail.com', 'owner@example.com', ' CLUBCRUMBIEADMIN@gmail.com '), ['clubcrumbieadmin@gmail.com', 'owner@example.com']);
});
test('recipient matching uses complete email addresses rather than substrings', () => {
 assert.deepEqual(emailAddresses('Customer <client@example.com>, Other <other@example.com>'), ['client@example.com', 'other@example.com']);
 assert.equal(emailAddresses('fakeclient@example.com').includes('client@example.com'), false);
});
