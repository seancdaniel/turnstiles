/* Turnstiles - reporting, blocking and the submission word filter.
 *
 * Apple 1.2 wants four things from an app with user-generated content: a filter
 * on what gets posted, a way to report, a way to block, and a published contact
 * address. The address is already on the About page; this file is the other
 * three, plus the admin side that makes a report worth filing.
 *
 * Honest about what each layer is:
 *   - the word filter stops the careless, not the determined. It runs in the
 *     browser and anyone can POST past it.
 *   - blocking hides content in the app. It is a comfort feature, not
 *     encryption, and the blocked person's rows are still public data.
 *   - reporting is the layer that actually works, because a person reads it.
 */

// ============================================================
// WORD FILTER
// ============================================================
/* Deliberately short. A long list of slurs in a repo is its own problem, and a
   half-hearted list invites false confidence; the report flow is the real
   backstop. Extend BLOCKED_WORDS as needed, or swap in a maintained list.

   WORD BOUNDARIES MATTER MORE THAN THE LIST. Substring matching would flag
   "passholder", "class", "Scunthorpe" and a hundred innocent words, and on a
   site where every other sentence contains "passholder" that would be a daily
   annoyance. Every term is matched as a whole word. */
var BLOCKED_WORDS = [
  'fuck', 'fucking', 'fucker', 'shit', 'bullshit', 'bitch', 'bastard',
  'cunt', 'dick', 'cock', 'pussy', 'whore', 'slut', 'wanker', 'twat',
  'retard', 'retarded', 'faggot', 'fag', 'nigger', 'nigga', 'spic', 'kike',
  'tranny', 'rape', 'rapist'
];

// a few obvious character swaps, so f*ck and sh1t do not sail through
function normaliseForFilter(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[@4]/g, 'a').replace(/[3]/g, 'e').replace(/[1!|]/g, 'i')
    .replace(/[0]/g, 'o').replace(/[$5]/g, 's').replace(/[7]/g, 't')
    .replace(/[^a-z0-9\s]/g, ' ');
}

/* Returns the first blocked word found, or '' if the text is fine. */
function findBlockedWord(text) {
  var norm = normaliseForFilter(text);
  for (var i = 0; i < BLOCKED_WORDS.length; i++) {
    if (new RegExp('\\b' + BLOCKED_WORDS[i] + '\\b').test(norm)) return BLOCKED_WORDS[i];
  }
  return '';
}

/* Check several fields at once before a submit. Returns true to proceed. */
function passesWordFilter(fields) {
  for (var i = 0; i < fields.length; i++) {
    if (findBlockedWord(fields[i])) {
      toast('That wording is not allowed here. Please rephrase and try again.', 'error');
      return false;
    }
  }
  return true;
}

// ============================================================
// BLOCKING
// ============================================================
/* Content-level only, by design: a blocked person still holds their leaderboard
   place. Hiding them from the boards would make ranks differ per viewer, so
   your #3 is somebody else's #2 and the board stops being a shared truth. A
   name and a number on a scoreboard is also not what harassment looks like. */
function blockedIds() {
  var out = {};
  (STATE.blocks || []).forEach(function (b) { out[b.blockedId] = true; });
  return out;
}

function isBlocked(userId) { return !!blockedIds()[userId]; }

async function blockUser(userId, btn) {
  if (!STATE.currentUser) { openOverlay('overlay-signin'); return; }
  if (userId === STATE.currentUser.id) return;
  if (btn && btn.disabled) return;
  if (btn) btn.disabled = true;
  try {
    var res = await sb.from('blocks').insert({ blocker_id: STATE.currentUser.id, blocked_id: userId });
    if (res.error && !/duplicate key/i.test(res.error.message || '')) {
      toast(modErr(res.error, 'Could not block that person.'), 'error');
      return;
    }
    closeOverlay('overlay-user-profile');
    await loadData();
    toast('Blocked. You will not see their photos or reviews.', 'info');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function unblockUser(userId, btn) {
  if (!STATE.currentUser) return;
  if (btn && btn.disabled) return;
  if (btn) btn.disabled = true;
  try {
    var res = await sb.from('blocks').delete()
      .eq('blocker_id', STATE.currentUser.id).eq('blocked_id', userId);
    if (res.error) { toast(modErr(res.error, 'Could not unblock.'), 'error'); return; }
    await loadData();
    toast('Unblocked.', 'info');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ============================================================
// REPORTING
// ============================================================
var reportCtx = null;   // { type, id, ownerId, label }

var REPORT_REASONS = [
  { key: 'offensive',  label: 'Offensive or inappropriate' },
  { key: 'harassment', label: 'Harassment or abuse' },
  { key: 'spam',       label: 'Spam or advertising' },
  { key: 'not_mine',   label: 'This is my content, posted by someone else' },
  { key: 'other',      label: 'Something else' }
];

function openReport(type, id, ownerId, label) {
  if (!STATE.currentUser) { openOverlay('overlay-signin'); return; }
  reportCtx = { type: type, id: id, ownerId: ownerId || null, label: label || '' };
  var what = document.getElementById('rp-what');
  if (what) what.textContent = label || 'this content';
  var sel = document.getElementById('rp-reason');
  if (sel) sel.innerHTML = REPORT_REASONS.map(function (r) {
    return '<option value="' + r.key + '">' + escapeHtml(r.label) + '</option>';
  }).join('');
  document.getElementById('rp-note').value = '';
  document.getElementById('rp-err').classList.remove('show');
  openOverlay('overlay-report');
}

async function submitReport(btn) {
  if (!STATE.currentUser || !reportCtx) return;
  if (btn && btn.disabled) return;
  var err = document.getElementById('rp-err');
  err.classList.remove('show');
  if (btn) btn.disabled = true;
  try {
    var res = await sb.from('reports').insert({
      reporter_id: STATE.currentUser.id,
      target_type: reportCtx.type,
      target_id: reportCtx.id,
      target_owner_id: reportCtx.ownerId,
      reason: document.getElementById('rp-reason').value,
      note: document.getElementById('rp-note').value.trim().slice(0, 500) || null
    });
    if (res.error) {
      err.textContent = modErr(res.error, 'Could not send that report. Try again.');
      err.classList.add('show');
      return;
    }
    closeOverlay('overlay-report');
    toast('Report sent. Thank you, we will take a look.', 'info');
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* The deploy lands before the SQL is run by hand, so a missing table has to say
   something a person can act on rather than leaking a schema-cache error. */
function modErr(err, fallback) {
  var m = (err && err.message) || '';
  if (/schema cache|does not exist|Could not find the table/i.test(m)) {
    return 'Reporting is not set up yet. Email help@goturnstiles.com and we will look into it.';
  }
  if (/row-level security/i.test(m)) return 'You do not have permission to do that.';
  return fallback;
}

// ============================================================
// ADMIN: the reports queue
// ============================================================
function isAdminUser() { return !!(STATE.currentUser && STATE.currentUser.isAdmin); }

var reportFilter = 'open';
function setReportFilter(v) { reportFilter = v; renderReports(); }

function reportTargetLabel(r) {
  return { photo: 'Photo', food_review: 'Food review',
    festival_review: 'Festival review', profile: 'Profile' }[r.targetType] || r.targetType;
}

function renderReportsView() {
  var gate = document.getElementById('rq-gate');
  var body = document.getElementById('rq-body');
  if (!gate || !body) return;
  var admin = isAdminUser();
  gate.style.display = admin ? 'none' : 'block';
  body.style.display = admin ? 'block' : 'none';
  if (admin) renderReports();
}

function renderReports() {
  var el = document.getElementById('rq-list');
  if (!el) return;
  var rows = (STATE.reports || []).filter(function (r) {
    return reportFilter === 'all' || r.status === reportFilter;
  });

  document.querySelectorAll('#view-reports .page-tab').forEach(function (b) {
    b.classList.toggle('active', b.dataset.f === reportFilter);
  });

  if (!rows.length) {
    el.innerHTML = '<div class="lb2-empty"><div class="lb2-empty-t">Nothing here</div>' +
      '<div class="lb2-empty-s">' +
      (reportFilter === 'open' ? 'No open reports. That is the good outcome.' : 'No reports in this list.') +
      '</div></div>';
    return;
  }

  el.innerHTML = rows.map(function (r) {
    var who = (STATE.users || []).find(function (u) { return u.id === r.targetOwnerId; });
    var by = (STATE.users || []).find(function (u) { return u.id === r.reporterId; });
    return '<div class="rq-row">' +
      '<div class="rq-main">' +
        '<div class="rq-head">' +
          '<span class="rq-type">' + escapeHtml(reportTargetLabel(r)) + '</span>' +
          '<span class="rq-reason">' + escapeHtml(r.reason.replace('_', ' ')) + '</span>' +
          '<span class="rq-status is-' + escapeHtml(r.status) + '">' + escapeHtml(r.status) + '</span>' +
        '</div>' +
        '<div class="rq-meta">Posted by ' + escapeHtml(who ? who.username : 'unknown') +
          ' · reported by ' + escapeHtml(by ? by.username : 'unknown') +
          ' · ' + timeAgo(r.ts) + '</div>' +
        (r.note ? '<div class="rq-note">' + escapeHtml(r.note) + '</div>' : '') +
      '</div>' +
      '<div class="rq-acts">' +
        (r.status === 'open'
          ? '<button class="btn-sm danger" onclick="removeReported(\'' + r.id + '\', this)">Remove content</button>' +
            '<button class="btn-sm" onclick="setReportStatus(\'' + r.id + '\', \'dismissed\', this)">Dismiss</button>'
          : '<button class="btn-sm" onclick="setReportStatus(\'' + r.id + '\', \'open\', this)">Reopen</button>') +
      '</div>' +
    '</div>';
  }).join('');
}

var REPORT_TABLE = { photo: 'photos', food_review: 'food_reviews', festival_review: 'festival_reviews' };

async function removeReported(reportId, btn) {
  if (!isAdminUser()) return;
  if (btn && btn.disabled) return;
  var r = (STATE.reports || []).find(function (x) { return x.id === reportId; });
  if (!r) return;
  var table = REPORT_TABLE[r.targetType];
  if (!table) { toast('A profile report has to be handled by hand.', 'info'); return; }
  if (!confirm('Delete this ' + reportTargetLabel(r).toLowerCase() + '? This cannot be undone.')) return;
  if (btn) btn.disabled = true;
  try {
    var del = await sb.from(table).delete().eq('id', r.targetId);
    if (del.error) { toast(modErr(del.error, 'Could not remove it.'), 'error'); return; }
    await setReportStatus(reportId, 'actioned');
    toast('Content removed.', 'info');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function setReportStatus(reportId, status, btn) {
  if (!isAdminUser()) return;
  if (btn && btn.disabled) return;
  if (btn) btn.disabled = true;
  try {
    var res = await sb.from('reports').update({ status: status }).eq('id', reportId);
    if (res.error) { toast(modErr(res.error, 'Could not update that report.'), 'error'); return; }
    await loadData();
    showView('reports');
  } finally {
    if (btn) btn.disabled = false;
  }
}
