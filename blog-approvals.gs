/*
 * FitPlan Blog Approvals — Google Apps Script web app
 * ====================================================
 * Paste THIS ENTIRE FILE into a new Apps Script project at https://script.google.com
 * (File > New > Script), then follow the "setup" steps in the chat log:
 *
 *   1. After pasting, press Save (the project name "FitPlan Blog Approvals" is fine).
 *   2. Click "Deploy > New deployment".
 *      - Type: Web app
 *      - Execute as: Me
 *      - Who has access: Anyone
 *      - Click Deploy, authorize, and COPY the /exec URL.
 *   3. Click the padlock "Project Settings" icon (left sidebar) > "Script properties" > "Add script property" and add TWO rows:
 *        GITHUB_TOKEN  = your GitHub token (see step 4)
 *        APP_URL       = the /exec URL you just copied
 *   4. Create the GitHub token at https://github.com/settings/tokens
 *      - "Generate new token" (Fine-grained), Repository access: Only select repositories > Fitness-Plan
 *      - Permissions > Repository permissions > Contents: Read and write
 *      - Copy the token, add it to the Script property GITHUB_TOKEN above.
 *   5. (Optional) Add OWNER_EMAIL = the email you want approval links sent to.
 *      If you skip it, it uses the Google account you deployed with.
 *
 * That's it. The form now stores submissions in a Google Sheet ("FitPlan Blog
 * Submissions") and emails you with Approve / Reject buttons.
 *
 * Clicking Approve  -> writes the post into blogs-data.json on GitHub and pushes it,
 *                      then emails the writer that their post is live.
 * Clicking Reject   -> does not publish, emails the writer that it wasn't approved.
 */

function doPost(e) {
  try {
    var p = e.parameter || {};
    if (p.botcheck) {
      return json_({ success: true }); // honeypot — silently ignore bots
    }
    var title = String(p.title || '').trim();
    var content = String(p.blog_content || '').trim();
    if (!title || !content) {
      return json_({ success: false, error: 'Missing title or content.' });
    }

    var cfg = getConfig_();
    var sh = getSpreadsheet_();
    var cat = normalizeCat_(String(p.category || 'lifestyle'));

    sh.appendRow(['', title, cat, String(p.author || 'Anonymous'), String(p.email || ''), content, 'pending', new Date()]);
    var row = sh.getLastRow();
    sh.getRange(row, 1).setValue(row - 1);

    try { notifyOwner_(row, title, cat, String(p.author || 'Anonymous'), String(p.email || ''), content, cfg); } catch (err) {}

    if (p.email) {
      try {
        MailApp.sendEmail(String(p.email), 'We received your FitPlan blog post',
          'Hi!\n\nThanks for submitting "' + title + '" to the FitPlan Blog! Our team will review it, and you will get an email as soon as it is approved or rejected.\n\n— FitPlan Blog',
          { name: 'FitPlan Blog' });
      } catch (err) {}
    }

    return json_({ success: true });
  } catch (err) {
    return json_({ success: false, error: String(err) });
  }
}

function doGet(e) {
  try {
    var cfg = getConfig_();
    var action = e.parameter.action;
    var id = e.parameter.id;
    var key = e.parameter.key || '';

    if (action === 'approve' || action === 'reject') {
      if (key !== cfg.key) return html_('Error: this link is not valid.', false);
      var row = findRow_(id);
      if (!row) return html_('This submission no longer exists in the queue.', false);

      var sh = getSpreadsheet_();
      var status = sh.getRange(row, 7).getValue();
      if (status !== 'pending') return html_('This submission was already ' + status + '.', false);

      if (action === 'approve') {
        var err = publishToGithub_(row, cfg);
        if (err) return html_('Publish failed: ' + err, false);
        sh.getRange(row, 7).setValue('approved');
        try { notifyWriter_(row, true); } catch (e) {}
        return html_('Post published to the FitPlan Blog! The writer has been emailed. New posts appear on the site after the push syncs.', true);
      } else {
        sh.getRange(row, 7).setValue('rejected');
        try { notifyWriter_(row, false); } catch (e) {}
        return html_('Post rejected. Nothing was published, and the writer has been emailed.', true);
      }
    }

    return html_('FitPlan Blog Approvals is running.', true);
  } catch (err) {
    return html_('Error: ' + err, false);
  }
}

/* ── helpers ── */

function getConfig_() {
  var p = PropertiesService.getScriptProperties();
  var key = p.getProperty('APPROVE_KEY');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    p.setProperty('APPROVE_KEY', key);
  }
  return {
    token: p.getProperty('GITHUB_TOKEN') || '',
    repo: p.getProperty('GITHUB_REPO') || 'akash-0127/Fitness-Plan',
    branch: p.getProperty('GITHUB_BRANCH') || 'main',
    url: p.getProperty('APP_URL') || '',
    key: key,
    owner: p.getProperty('OWNER_EMAIL') || Session.getEffectiveUser().getEmail()
  };
}

function getSpreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  var ss;
  if (id) {
    try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create('FitPlan Blog Submissions');
    PropertiesService.getScriptProperties().setProperty('SHEET_ID', ss.getId());
  }
  var sh = ss.getSheetByName('Submissions');
  if (!sh) {
    sh = ss.insertSheet('Submissions');
    sh.appendRow(['id', 'title', 'category', 'author', 'writer_email', 'content', 'status', 'submitted_at']);
  }
  return sh;
}

function findRow_(id) {
  var sh = getSpreadsheet_();
  if (sh.getLastRow() < 2) return null;
  var ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return null;
}

function normalizeCat_(c) {
  var map = { workout: 'workout', recipes: 'recipes', health: 'health', lifestyle: 'lifestyle' };
  return map[String(c).toLowerCase().trim()] || 'lifestyle';
}

function buildPost_(row) {
  var sh = getSpreadsheet_();
  var v = sh.getRange(row, 1, 1, 8).getValues()[0];
  var content = String(v[5]).replace(/\r\n/g, '\n').trim();
  var words = content.split(/\s+/).length;
  var mins = Math.max(1, Math.round(words / 200));
  var excerpt = content.split(/\n\n/)[0].replace(/\n/g, ' ').trim();
  if (excerpt.length > 140) excerpt = excerpt.slice(0, 137).trim() + '\u2026';
  return {
    title: String(v[1]).trim(),
    category: String(v[2]),
    excerpt: excerpt,
    content: content,
    author: String(v[3]) || 'Anonymous',
    date: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'),
    readTime: mins + ' min read'
  };
}

function publishToGithub_(row, cfg) {
  if (!cfg.token) return 'missing GITHUB_TOKEN. Add it under Project Settings > Script properties.';
  if (!cfg.url) return 'missing APP_URL. Add your web app /exec URL under Script properties.';

  var api = 'https://api.github.com/repos/' + cfg.repo + '/contents/blogs-data.json';
  var headers = {
    'Authorization': 'Bearer ' + cfg.token,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'FitPlan-Blog-Approvals'
  };

  try {
    var getRes = UrlFetchApp.fetch(api, { headers: headers, muteHttpExceptions: true });
    if (getRes.getResponseCode() !== 200) {
      return 'could not read blogs-data.json (' + getRes.getResponseCode() + ') ' + getRes.getContentText();
    }
    var meta = JSON.parse(getRes.getContentText());
    var b64 = String(meta.content).replace(/\s+/g, '');
    var fileJson = JSON.parse(Utilities.newBlob(Utilities.base64Decode(b64), 'application/json', 'blogs-data.json').getDataAsString('UTF-8'));

    var posts = fileJson.posts || [];
    var maxId = posts.reduce(function (m, p) { return Math.max(m, parseInt(p.id, 10) || 0); }, 0);
    var post = buildPost_(row);
    post.id = String(maxId + 1);
    posts.push(post);
    fileJson.posts = posts;

    var newJson = JSON.stringify(fileJson, null, 2);
    var putBody = {
      message: 'Blog: publish "' + post.title + '"',
      content: Utilities.base64Encode(Utilities.newBlob(newJson).getBytes()),
      branch: cfg.branch,
      sha: meta.sha
    };
    var putRes = UrlFetchApp.fetch(api, {
      method: 'put',
      headers: headers,
      contentType: 'application/json',
      payload: JSON.stringify(putBody),
      muteHttpExceptions: true
    });
    if (putRes.getResponseCode() !== 200 && putRes.getResponseCode() !== 201) {
      return 'could not write blogs-data.json (' + putRes.getResponseCode() + ') ' + putRes.getContentText();
    }
    return null;
  } catch (err) {
    return String(err);
  }
}

function notifyWriter_(row, approved) {
  var sh = getSpreadsheet_();
  var v = sh.getRange(row, 1, 1, 8).getValues()[0];
  var email = String(v[4]);
  var title = String(v[1]);
  if (!email) return;
  var url = 'https://akash-0127.github.io/Fitness-Plan/blogs.html';
  if (approved) {
    MailApp.sendEmail(email, 'Your FitPlan blog post is live!',
      'Hi!\n\nGood news — your post "' + title + '" was approved and is now published on the FitPlan Blog.\n\nRead it here: ' + url,
      { name: 'FitPlan Blog' });
  } else {
    MailApp.sendEmail(email, 'Update on your FitPlan blog post',
      'Hi!\n\nThanks for submitting "' + title + '" to the FitPlan Blog. Unfortunately it was not approved this time. Feel free to revise it and submit again!\n\n— FitPlan Blog',
      { name: 'FitPlan Blog' });
  }
}

function notifyOwner_(row, title, cat, author, email, content, cfg) {
  var base = cfg.url;
  var id = row - 1;
  var a = base + '?action=approve&id=' + id + '&key=' + encodeURIComponent(cfg.key);
  var r = base + '?action=reject&id=' + id + '&key=' + encodeURIComponent(cfg.key);
  var catLabel = cat.charAt(0).toUpperCase() + cat.slice(1);
  var html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;color:#1f2937">' +
      '<h2 style="color:#16a34a;margin:0 0 12px">New FitPlan blog submission</h2>' +
      '<p style="margin:0 0 16px">A writer submitted a new post. Review it below, then click a button.</p>' +
      '<table style="border-collapse:collapse;width:100%;font-size:14px;margin-bottom:16px">' +
        '<tr><td style="border:1px solid #e5e7eb;padding:8px 10px;background:#f9fafb;font-weight:bold;width:110px">Title</td><td style="border:1px solid #e5e7eb;padding:8px 10px">' + esc_(title) + '</td></tr>' +
        '<tr><td style="border:1px solid #e5e7eb;padding:8px 10px;background:#f9fafb;font-weight:bold">Category</td><td style="border:1px solid #e5e7eb;padding:8px 10px">' + esc_(catLabel) + '</td></tr>' +
        '<tr><td style="border:1px solid #e5e7eb;padding:8px 10px;background:#f9fafb;font-weight:bold">Author</td><td style="border:1px solid #e5e7eb;padding:8px 10px">' + esc_(author) + '</td></tr>' +
        '<tr><td style="border:1px solid #e5e7eb;padding:8px 10px;background:#f9fafb;font-weight:bold">Email</td><td style="border:1px solid #e5e7eb;padding:8px 10px">' + esc_(email || '—') + '</td></tr>' +
      '</table>' +
      '<div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;background:#f9fafb;font-size:13px;line-height:1.6;white-space:pre-wrap">' + esc_(content) + '</div>' +
      '<p style="margin:18px 0 0">' +
        '<a href="' + a + '" style="display:inline-block;background:#16a34a;color:#ffffff;text-decoration:none;font-weight:bold;padding:11px 20px;border-radius:6px;margin-right:8px">Approve &amp; publish</a>' +
        '<a href="' + r + '" style="display:inline-block;background:#dc2626;color:#ffffff;text-decoration:none;font-weight:bold;padding:11px 20px;border-radius:6px">Reject</a>' +
      '</p>' +
      '<p style="font-size:11px;color:#9ca3af;margin-top:16px">These links work only for this submission. Rejecting does not publish anything.</p>' +
    '</div>';
  MailApp.sendEmail(cfg.owner, 'New FitPlan blog submission — ' + title, 'A new post was submitted: ' + title + '\n\nOpen this email in a browser to use the Approve/Reject buttons.', { htmlBody: html, name: 'FitPlan Blog' });
}

function esc_(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function html_(msg, ok) {
  var color = ok ? '#16a34a' : '#dc2626';
  return HtmlService.createHtmlOutput(
    '<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;background:#f9fafb;padding:40px;text-align:center">' +
    '<div style="display:inline-block;background:#ffffff;border-radius:12px;padding:32px 40px;box-shadow:0 1px 3px rgba(0,0,0,0.1)">' +
    '<div style="font-size:40px;margin-bottom:12px">' + (ok ? '&#9989;' : '&#9888;&#65039;') + '</div>' +
    '<div style="color:' + color + ';font-weight:bold;font-size:16px">' + esc_(msg) + '</div>' +
    '</div></body></html>'
  );
}
