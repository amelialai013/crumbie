export const enquiryMailbox = "clubcrumbieadmin@gmail.com";

export function enquiryReference(id: string) {
 return `[Crumbie enquiry: ${id}]`;
}

export function enquiryIdFromSubject(subject: string) {
 return subject.match(/\[Crumbie enquiry: ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/i)?.[1].toLowerCase() || null;
}

export function notificationRecipients(...addresses: Array<string | undefined>) {
 return [...new Set(addresses.map(value => value?.trim().toLowerCase()).filter((value): value is string => !!value))];
}

export function emailAddresses(value: string) {
 return (value.match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || []).map(address => address.toLowerCase());
}

export type StoredEnquiryReply = { subject: string; message: string; sentAt: string; source?: "gmail"; direction?: "incoming" | "outgoing"; externalId?: string };
