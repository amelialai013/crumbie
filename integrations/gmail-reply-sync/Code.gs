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
          if (token && addresses_(mail.getTo()).includes(c.mailbox)) {
            c.props.setProperty('ANCHOR_' + token.split('.')[0], mail.getId());
          }
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

function addresses_(value) {
  return (String(value || '').match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || []).map(x => x.toLowerCase());
}
function jsonOutput_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

/** Private authenticated sender; deploy as owner, accessible to Anyone. */
function doPost(e) {
  let lock;
  try {
    const c = crumbieConfig_();
    const data = JSON.parse(e.postData.contents);
    // Credentials travel in the POST body, never URLs or logs.
    if (typeof data.secret !== 'string' || data.secret !== c.secret) return jsonOutput_({ ok: false, error: 'Unauthorized' });
    if (Session.getEffectiveUser().getEmail().toLowerCase() !== c.mailbox) throw new Error('Wrong account');
    if (!/^[a-f0-9-]{36}$/i.test(data.requestId || '') || !/^[a-f0-9-]{36}$/i.test(data.id || '') ||
        typeof data.threadToken !== 'string' || !data.threadToken.startsWith(data.id + '.') ||
        addresses_(data.to).length !== 1 || addresses_(data.to)[0] !== data.to.toLowerCase() ||
        typeof data.text !== 'string' || data.text.length > 20000 || !data.text.trim() ||
        typeof data.html !== 'string' || data.html.length > 100000) throw new Error('Invalid reply');
    lock = LockService.getScriptLock();
    if (!lock.tryLock(20000)) throw new Error('Sender busy; retry the same reply');
    const key = 'SEND_' + data.requestId;
    const fingerprint = Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
      JSON.stringify([data.id, data.to, data.subject, data.text, data.html])));
    const prior = JSON.parse(c.props.getProperty(key) || 'null');
    if (prior && prior.fingerprint !== fingerprint) throw new Error('Reply request changed');
    if (prior && prior.receipt) return jsonOutput_(prior.receipt);
    let anchor;
    const anchorId = c.props.getProperty('ANCHOR_' + data.id);
    if (anchorId) anchor = GmailApp.getMessageById(anchorId);
    if (!anchor) {
      // Covers a new notification arriving before the next five-minute sync.
      for (let offset = 0; offset < 1000 && !anchor; offset += 50) {
        const threads = GmailApp.search('to:' + c.mailbox + ' -in:trash -in:spam', offset, 50);
        for (const thread of threads) {
          anchor = thread.getMessages().find(mail => !mail.isDraft() && mail.getHeader('X-Crumbie-Enquiry') === data.threadToken && addresses_(mail.getTo()).includes(c.mailbox));
          if (anchor) break;
        }
        if (threads.length < 50) break;
      }
    }
    if (!anchor || anchor.getHeader('X-Crumbie-Enquiry') !== data.threadToken ||
        addresses_(anchor.getReplyTo() || anchor.getFrom()).length !== 1 ||
        addresses_(anchor.getReplyTo() || anchor.getFrom())[0] !== data.to.toLowerCase()) {
      throw new Error('Matching enquiry notification not found; no email sent');
    }
    c.props.setProperty('ANCHOR_' + data.id, anchor.getId());
    let draft;
    if (prior) {
      // A missing prepared draft may already have been sent: never blindly resend.
      try { draft = GmailApp.getDraft(prior.draftId); } catch (_) { throw new Error('Delivery uncertain; check Gmail Sent before composing a new reply'); }
      if (!draft) throw new Error('Delivery uncertain; check Gmail Sent');
    } else {
      draft = anchor.createDraftReply(data.text, { htmlBody: data.html, name: 'Club Crumbie', replyTo: c.mailbox });
      c.props.setProperty(key, JSON.stringify({ fingerprint, draftId: draft.getId(), createdAt: Date.now() }));
    }
    const sent = draft.send();
    const receipt = { ok: true, messageId: sent.getId(), sentAt: sent.getDate().toISOString(), subject: sent.getSubject() };
    c.props.setProperty(key, JSON.stringify({ fingerprint, receipt, createdAt: Date.now() }));
    return jsonOutput_(receipt);
  } catch (error) {
    return jsonOutput_({ ok: false, error: String(error.message || 'Unable to confirm Gmail delivery') });
  } finally { if (lock) lock.releaseLock(); }
}
