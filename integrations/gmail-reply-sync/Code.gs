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
    const since = c.props.getProperty('INCOMING_SYNC_VERSION') === '2'
      ? Number(c.props.getProperty('LAST_SUCCESS_MS')) || started - 30 * 86400000
      : started - 30 * 86400000;
    const after = Math.floor((since - 86400000) / 1000);
    const query = '-in:spam -in:trash after:' + after;
    const seen = new Set();
    let complete = false;
    const messages = [];
    for (let offset = 0; offset < 1000; offset += 50) {
      const threads = GmailApp.search(query, offset, 50);
      for (const thread of threads) {
        messages.push(...thread.getMessages());
      }
      if (threads.length < 50) { complete = true; break; }
    }
    if (!complete) throw new Error('Sync backlog exceeds 1000 threads. Watermark retained.');
    // Register signed originals before processing replies, even across Gmail threads.
    messages.sort((a, b) => Number(!!b.getHeader('X-Crumbie-Enquiry')) - Number(!!a.getHeader('X-Crumbie-Enquiry')) || a.getDate().getTime() - b.getDate().getTime());
    for (const mail of messages) {
          const token = mail.getHeader('X-Crumbie-Enquiry');
          if (mail.isDraft() || seen.has(mail.getId()) || (!token && mail.getDate().getTime() < after * 1000) || mail.getDate().getTime() > started) continue;
          seen.add(mail.getId());
          const from = mail.getFrom();
          const references = (mail.getHeader('References') + ' ' + mail.getHeader('In-Reply-To')).trim();
          if (!token && !references && !/\[Crumbie enquiry: [0-9a-f-]{36}\]/i.test(mail.getSubject())) continue;
          // Keep the complete plain-text email, including signature/quoted context.
          const message = mail.getPlainBody().trim();
          if (!message) continue;
          const response = UrlFetchApp.fetch(c.endpoint, {
            method: 'post', contentType: 'application/json',
            headers: { Authorization: 'Bearer ' + c.secret },
            payload: JSON.stringify({ messageId: mail.getId(), threadToken: token || undefined, rfcMessageId: mail.getHeader('Message-ID'), references, from, to: mail.getTo(), cc: mail.getCc(),
              subject: mail.getSubject(), message, sentAt: mail.getDate().toISOString() }),
            muteHttpExceptions: true, followRedirects: false
          });
          const status = response.getResponseCode();
          // Deleted enquiries and forwarded messages to other recipients are ignored.
          if (status === 400 || status === 404) continue;
          if (status !== 200) throw new Error('Crumbie sync failed (HTTP ' + status + '). Check configuration and retry.');
    }
    // Enable clean subjects only after this version has successfully completed a sync.
    const ready = UrlFetchApp.fetch(c.endpoint, {
      method: 'post', contentType: 'application/json', headers: { Authorization: 'Bearer ' + c.secret },
      payload: JSON.stringify({ capability: 'message-headers-v2' }), muteHttpExceptions: true, followRedirects: false
    });
    if (ready.getResponseCode() !== 200) throw new Error('Could not enable header matching.');
    c.props.setProperty('LAST_SUCCESS_MS', String(started));
    c.props.setProperty('INCOMING_SYNC_VERSION', '2');
  } finally { lock.releaseLock(); }
}

function uninstallCrumbieSync() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'syncCrumbieReplies')
    .forEach(t => ScriptApp.deleteTrigger(t));
}
