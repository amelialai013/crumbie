/** Runs only in clubcrumbieadmin@gmail.com's Apps Script account. */
function installCrumbieSync() {
  const config = crumbieConfig_();
  if (Session.getEffectiveUser().getEmail().toLowerCase() !== config.mailbox) {
    throw new Error('Sign in as ' + config.mailbox + ' before installing this sync.');
  }
  // Authorise Gmail and the endpoint before installing a recurring trigger.
  syncCrumbieReplies();
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'syncCrumbieReplies')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncCrumbieReplies').timeBased().everyMinutes(5).create();
}

function crumbieConfig_() {
  const props = PropertiesService.getScriptProperties();
  const secret = (props.getProperty('GMAIL_REPLY_SYNC_SECRET') || '').trim();
  const endpoint = (props.getProperty('CRUMBIE_SYNC_URL') || 'https://clubcrumbie.com/api/integrations/gmail/reply').trim();
  if (secret.length < 32 || !/^https:\/\/[^/]+\/api\/integrations\/gmail\/reply$/.test(endpoint)) {
    throw new Error('Set CRUMBIE_SYNC_URL and GMAIL_REPLY_SYNC_SECRET in Script Properties first.');
  }
  return { secret, endpoint, mailbox: 'clubcrumbieadmin@gmail.com', props };
}

function syncCrumbieReplies() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const c = crumbieConfig_();
    if (Session.getEffectiveUser().getEmail().toLowerCase() !== c.mailbox) throw new Error('Wrong Gmail account.');
    const started = Date.now();
    // One-day overlap catches indexing delays; the endpoint deduplicates message IDs.
    const since = c.props.getProperty('INCOMING_SYNC_VERSION') === '1'
      ? Number(c.props.getProperty('LAST_SUCCESS_MS')) || started - 30 * 86400000
      : started - 30 * 86400000;
    const after = Math.floor((since - 86400000) / 1000);
    const query = '-in:spam -in:trash after:' + after + ' subject:"Crumbie enquiry"';
    const seen = new Set();
    let complete = false;
    for (let offset = 0; offset < 1000; offset += 50) {
      const threads = GmailApp.search(query, offset, 50);
      for (const thread of threads) {
        for (const mail of thread.getMessages()) {
          if (mail.isDraft() || seen.has(mail.getId()) || mail.getDate().getTime() < after * 1000 || mail.getDate().getTime() > started) continue;
          seen.add(mail.getId());
          const from = mail.getFrom();
          if (!/\[Crumbie enquiry: [0-9a-f-]{36}\]/i.test(mail.getSubject())) continue;
          // Keep the complete plain-text email, including signature/quoted context.
          const message = mail.getPlainBody().trim();
          if (!message) continue;
          const response = UrlFetchApp.fetch(c.endpoint, {
            method: 'post', contentType: 'application/json',
            headers: { Authorization: 'Bearer ' + c.secret },
            payload: JSON.stringify({ messageId: mail.getId(), from, to: mail.getTo(), cc: mail.getCc(),
              subject: mail.getSubject(), message, sentAt: mail.getDate().toISOString() }),
            muteHttpExceptions: true, followRedirects: false
          });
          const status = response.getResponseCode();
          // Deleted enquiries and forwarded messages to other recipients are ignored.
          if (status === 400 || status === 404) continue;
          if (status !== 200) throw new Error('Crumbie sync failed (HTTP ' + status + '). Check configuration and retry.');
        }
      }
      if (threads.length < 50) { complete = true; break; }
    }
    if (!complete) throw new Error('Sync backlog exceeds 1000 threads. Watermark retained; narrow the initial window before retrying.');
    c.props.setProperty('LAST_SUCCESS_MS', String(started));
    c.props.setProperty('INCOMING_SYNC_VERSION', '1');
  } finally { lock.releaseLock(); }
}

function uninstallCrumbieSync() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'syncCrumbieReplies')
    .forEach(t => ScriptApp.deleteTrigger(t));
}
