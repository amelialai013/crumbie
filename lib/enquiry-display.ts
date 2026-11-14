// Display cleanup only: retain the original email unchanged in storage.
export function enquiryMessageDisplay(message: string, outgoing: boolean) {
 const text = message.replace(/\r\n/g, "\n");
 let visible = text;
 // Only collapse trailing >-quoted history; preserve inline answers after quotes.
 const quoted = /^(?=[ \t]*>)/gm;
 for (const match of Array.from(text.matchAll(quoted))) {
  const tail = text.slice(match.index);
  if (tail.split("\n").every(line => !line.trim() || /^[ \t]*>/.test(line))) {
   visible = text.slice(0, match.index).trimEnd();
   break;
  }
 }
 // Gmail/Apple Mail may place the reply attribution on an unquoted line.
 const attribution = /^(?:On [^\n]{1,300}(?:\n[^\n]{1,300}){0,3}?wrote:|[-_]{3,}\s*Original Message\s*[-_]{3,})[ \t]*$/im;
 const header = attribution.exec(visible);
 if (header) visible = visible.slice(0, header.index).trimEnd();
 // Outlook's unquoted history has a complete mail-header block, not just "From:".
 const outlook = /^From:[^\n]+\n(?:Sent|Date):[^\n]+\nTo:[^\n]+\n(?:Cc:[^\n]*\n)?Subject:[^\n]+/im.exec(visible);
 if (outlook) visible = visible.slice(0, outlook.index).trimEnd();
 if (outgoing) {
  // Some mail clients append the link destination directly after its label.
  const signature = /\n(?:[ \t]*Club Crumbie[ \t]*\n)+[ \t]*clubcrumbieadmin@gmail\.com(?:[ \t]*<mailto:clubcrumbieadmin@gmail\.com>)?[ \t]*\n[ \t]*clubcrumbie\.com(?:[ \t]*<https:\/\/clubcrumbie\.com\/?>)?[ \t]*\n[ \t]*Instagram\b/i;
  const match = signature.exec(visible);
  if (match) {
   visible = visible.slice(0, match.index).trimEnd();
   // The logo can appear as an image URL followed by its link, or just the link.
   visible = visible.replace(/\n[ \t]*<https:\/\/clubcrumbie\.com\/?>[ \t]*$/i, "").trimEnd();
   visible = visible.replace(/\n[ \t]*\[https:\/\/clubcrumbie\.com\/email\/club-crumbie-logo-1-276\.png\][ \t]*$/i, "").trimEnd();
  }
 }
 // A quote-only email still needs to be readable.
 return visible.trim() ? visible : text;
}
