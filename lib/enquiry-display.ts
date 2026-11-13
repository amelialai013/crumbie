// Display cleanup only: retain the original email unchanged in storage.
export function enquiryMessageDisplay(message: string, outgoing: boolean) {
 const text = message.replace(/\r\n/g, "\n");
 if (!outgoing) return text;
 // Only remove our known signature, never arbitrary customer text or quoted mail.
 const signature = /\n(?:Club Crumbie\n)+clubcrumbieadmin@gmail\.com\nclubcrumbie\.com\nInstagram\b/;
 const match = signature.exec(text);
 return match ? text.slice(0, match.index).trimEnd() : text;
}
