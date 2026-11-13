# Gmail enquiry reply sync

New enquiries remain in the admin portal and notify `clubcrumbieadmin@gmail.com`, plus any existing configured notification addresses. Notifications use the customer's Reply-To address. Reply normally from Gmail. New messages use clean subjects; hidden signed headers and standard Message-ID / References / In-Reply-To headers link replies. The sync imports both outgoing replies and customer responses every five minutes. Outgoing replies mark the enquiry replied; a new latest customer response marks it unread and pending. It does not send emails, delete mail, change labels, or import unrelated conversations. Legacy messages with enquiry references remain supported. Historical messages without references or a registered message ID cannot be linked automatically. Attachments are not imported; the complete plain-text message (including quoted history) is shown. Only messages between the enquiry customer and the Club Crumbie mailbox are accepted. Drafts are excluded.

## One-time setup

1. Deploy this app's code to the live site. Generate a unique random secret of at least 32 characters (for example `openssl rand -hex 32`). Set `GMAIL_REPLY_SYNC_SECRET` as a server-only environment variable on the deployment and redeploy. Never use the admin password or commit this secret.
2. In Google Apps Script, signed in as **clubcrumbieadmin@gmail.com**, create a standalone project. Copy `Code.gs` and `appsscript.json` from this folder. Enable “Show appsscript.json manifest file” in Project Settings to edit the manifest.
3. In Project Settings → Script Properties, set:
   - `CRUMBIE_SYNC_URL` (optional): defaults to `https://clubcrumbie.com/api/integrations/gmail/reply`
   - `GMAIL_REPLY_SYNC_SECRET`: the exact same generated secret as the deployment.
4. Run `installCrumbieSync` and authorise Google. It checks the account, performs an initial sync of the last 30 days and installs one five-minute trigger. Running it again replaces the trigger without duplicating portal replies. GmailApp requires Google's broad Gmail scope even though this script only reads messages; review the supplied source before authorising.
5. Submit a real enquiry, receive its notification, and reply to the customer in Gmail. Run `syncCrumbieReplies` (or wait five minutes), then open the portal: the reply should display with “Gmail”, the sent time, and replied status. Run again to confirm it appears only once.

Check Apps Script Executions for failures. Failed HTTP requests retain the watermark and retry next time. Invalid/deleted enquiry references or mismatched recipients are ignored. The secret authenticates the bridge; rotate it in both places if exposed. No app password or Gmail OAuth token is stored in the Crumbie app. Run `uninstallCrumbieSync` to stop syncing.

The integration is not active until these deployment and Google authorisation steps are completed.

## Installed project

Crumbie Gmail Reply Sync is installed under clubcrumbieadmin@gmail.com:
https://script.google.com/home/projects/1RN27m8EpTzH2zvzKIAvKVrSjUiCNZCy9DHBRhcnrKnPdL26RmQPPSjLT/edit

Activated and tested in production on 11 November 2026. The production secret is configured in Vercel and Script Properties, and one five-minute trigger is installed. A live test enquiry delivered its notification to Gmail; a normal Gmail reply imported with source `gmail` and status `replied`. A second sync left exactly one reply, confirming duplicate protection. The test enquiry was removed after verification.

## Incoming reply upgrade

Deploy the updated app first, then replace Code.gs in the installed project and save it. Run syncCrumbieReplies once. The first successful upgraded run backfills the last 30 days (with a one-day overlap), including customer responses previously skipped; existing sent replies are deduplicated. The existing five-minute trigger continues running. Legacy threads retain reference-based matching; new threads use hidden message identifiers.

Incoming sync activated on 12 November 2026: saved Code.gs was checked against the repository source, installCrumbieSync completed successfully, and the trigger list confirmed one time-based syncCrumbieReplies trigger. Portal replies now carry the enquiry reference and direct customer responses to the synced Gmail mailbox. Historical conversations lacking references cannot be automatically matched; the initial backfill found no matching incoming responses among the six existing enquiries.

## Clean subject matching

New notification and portal reply messages include a signed `X-Crumbie-Enquiry` header. Portal replies BCC the admin mailbox so Gmail can register the delivered Message-ID, which can differ from the provider API ID. The bridge registers these originals before processing replies. The endpoint stores Message-ID mappings and resolves References / In-Reply-To, while validating the enquiry customer and mailbox. Original copies are not appended as duplicate replies. No matching by subject text or customer address alone is used. Existing reference-bearing conversations continue to sync. The bridge scans recent mail metadata to discover references even after a subject changes.

Deployment order: deploy the backward-compatible endpoint and sender, then save the revised Apps Script and run syncCrumbieReplies. Version 2 backfills the last 30 days. Never remove the legacy subject parser while historical threads remain active.

## Portal replies sent through Gmail

The installed Apps Script now also exposes an authenticated `doPost` web app, deployed to execute as clubcrumbieadmin@gmail.com with Anyone access. Every send requires the existing private shared secret in its POST body. Register its `/exec` URL in the datastore record `integration/gmail-sender` as `{ "url": "https://script.google.com/macros/s/DEPLOYMENT_ID/exec" }` only after deploying the portal upgrade. No OAuth token or password is copied to the website.

Portal replies create and send a Gmail draft reply to the signed original enquiry notification. The script verifies the notification token and its Reply-To customer before sending, preserves the original conversation subject, and uses the portal's HTML/plain-text signature. Gmail therefore owns delivery, Sent history and threading; no Resend duplicate/BCC is sent when this bridge is enabled. Notification and order emails still use Resend. Missing/mismatched originals fail without sending through another provider.

The composer retains a request UUID across retries. Under a script lock, the sender journals the draft before delivery and records the Gmail receipt afterwards. Repeated confirmed requests return that receipt; a missing prepared draft fails closed because it may already have been sent. Check Gmail Sent before creating a new reply after an uncertain-delivery error. The portal and inbound sync use the same `gmail:MESSAGE_ID` deduplication key. The five-minute sync continues importing customer replies.

The sender journal and anchor IDs are private Script Properties; monitor Apps Script storage/quota errors as enquiry volume grows. Changing deployed sender code requires updating its web-app deployment version, as well as saving Code.gs for scheduled sync. To disable Gmail sending, remove `integration/gmail-sender`; subsequent replies use the existing Resend path. Do not disable it to retry an uncertain delivery.

Portal display removes only the known Crumbie signature from outgoing imported mail, retaining the full original behind “Show full email”. Email HTML uses explicit line breaks so paragraph spacing survives Gmail's HTML-to-text conversion.

Activated on 14 November 2026. Live self-test: submitting an enquiry to the admin mailbox and replying through the production portal returned HTTP 200 and one `gmail:MESSAGE_ID` entry. Gmail Sent search showed the reply and original notification as a two-message conversation, with the branded signature and paragraph breaks intact. Retrying the identical portal request returned the same Gmail receipt and left one portal reply. The temporary test enquiry was removed after checking sync deduplication.

## Timestamp precision fix — 14 November 2026

Gmail/SMTP Date headers have second precision, while enquiry creation timestamps include milliseconds. Compare incoming email timestamps against the enquiry creation second rather than its raw milliseconds. Otherwise a notification created in the same second was rejected as an old anchor, preventing header-based reply matching. Regression tests cover same-second acceptance and rejection of genuinely earlier seconds. The production sync successfully recovered the 07:32 incoming customer reply and 07:34 outgoing laptop reply for the affected 07:26 enquiry; all three messages are present without duplicating the original portal reply. Its status remains replied because the latest message is outgoing. Scheduled sync continues every five minutes, with the portal refreshing its data every twenty seconds.
