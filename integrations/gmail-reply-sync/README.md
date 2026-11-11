# Gmail enquiry reply sync

New enquiries remain in the admin portal and notify `clubcrumbieadmin@gmail.com`, plus any existing configured notification addresses. Notifications use the customer's Reply-To address. Reply normally from Gmail, keeping the `[Crumbie enquiry: UUID]` reference in the subject. The sync imports the sent reply into the portal every five minutes and marks the enquiry replied. It does not send emails, delete mail, change labels, or import unrelated conversations. Existing notification emails without a reference cannot be linked automatically. Attachments and customer follow-up emails are not imported; the complete plain-text sent message (including quoted history) is shown.

## One-time setup

1. Deploy this app's code to the live site. Generate a unique random secret of at least 32 characters (for example `openssl rand -hex 32`). Set `GMAIL_REPLY_SYNC_SECRET` as a server-only environment variable on the deployment and redeploy. Never use the admin password or commit this secret.
2. In Google Apps Script, signed in as **clubcrumbieadmin@gmail.com**, create a standalone project. Copy `Code.gs` and `appsscript.json` from this folder. Enable “Show appsscript.json manifest file” in Project Settings to edit the manifest.
3. In Project Settings → Script Properties, set:
   - `CRUMBIE_SYNC_URL` (optional): defaults to `https://clubcrumbie.com/api/integrations/gmail/reply`
   - `GMAIL_REPLY_SYNC_SECRET`: the exact same generated secret as the deployment.
4. Run `installCrumbieSync` and authorise Google. It checks the account, performs an initial sync of the last 30 days and installs one five-minute trigger. Running it again replaces the trigger without duplicating portal replies. GmailApp requires Google's broad Gmail scope even though this script only reads sent messages; review the supplied source before authorising.
5. Submit a real enquiry, receive its notification, and reply to the customer in Gmail. Run `syncCrumbieReplies` (or wait five minutes), then open the portal: the reply should display with “Gmail”, the sent time, and replied status. Run again to confirm it appears only once.

Check Apps Script Executions for failures. Failed HTTP requests retain the watermark and retry next time. Invalid/deleted enquiry references or mismatched recipients are ignored. The secret authenticates the bridge; rotate it in both places if exposed. No app password or Gmail OAuth token is stored in the Crumbie app. Run `uninstallCrumbieSync` to stop syncing.

The integration is not active until these deployment and Google authorisation steps are completed.

## Installed project

Crumbie Gmail Reply Sync is installed under clubcrumbieadmin@gmail.com:
https://script.google.com/home/projects/1RN27m8EpTzH2zvzKIAvKVrSjUiCNZCy9DHBRhcnrKnPdL26RmQPPSjLT/edit

Activated and tested in production on 11 November 2026. The production secret is configured in Vercel and Script Properties, and one five-minute trigger is installed. A live test enquiry delivered its notification to Gmail; a normal Gmail reply imported with source `gmail` and status `replied`. A second sync left exactly one reply, confirming duplicate protection. The test enquiry was removed after verification.
