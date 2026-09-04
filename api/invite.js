// Turnstiles - send a friend an invite to the site.
//
// Called from the "Invite a Friend" item in the profile dropdown
// (supabase-invite.js). Reuses the Resend account already verified for
// goturnstiles.com by api/notify-signup.js, so the only environment
// variable this needs is one that already exists:
//
//   RESEND_API_KEY  - from the Resend dashboard
//
// SUPABASE_URL / SUPABASE_ANON_KEY may be set to override the defaults
// below, but they are the same public values already shipped in main.js,
// so there is nothing secret about them and nothing to configure.
//
// Every Vercel URL is publicly reachable, which makes an endpoint that
// sends mail an obvious spam relay. Three things stop that:
//   1. the caller must present a real Supabase access token, verified
//      against Supabase rather than trusted from the request body
//   2. the recipient is validated and capped at one per request
//   3. sends are logged to public.invites and capped per user per day
// The cap is enforced by reading that table back, so if the table is
// missing the request is refused rather than allowed through uncounted.

var SUPABASE_URL = process.env.SUPABASE_URL || 'https://guglgdsmqbtcvkmvxwrc.supabase.co';
var SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_IIjBhzSs6W-80OWArHjkZQ_ZGJ-Oxjo';
var SITE_URL = 'https://goturnstiles.com';

var DAILY_LIMIT = 10;
var MAX_NOTE = 300;

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// deliberately loose: the mail provider is the real authority on whether an
// address exists, this only rejects things that are obviously not addresses
function looksLikeEmail(s) {
  return typeof s === 'string' && s.length <= 254 && /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(s);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  // ---- who is asking ----
  var auth = req.headers.authorization || '';
  var token = auth.indexOf('Bearer ') === 0 ? auth.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'Sign in to send an invite.' });
    return;
  }

  var caller;
  try {
    var who = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token }
    });
    if (!who.ok) {
      res.status(401).json({ error: 'Your session has expired. Sign in again.' });
      return;
    }
    caller = await who.json();
  } catch (e) {
    console.error('invite: auth check failed:', e);
    res.status(502).json({ error: 'Could not verify your session.' });
    return;
  }
  if (!caller || !caller.id) {
    res.status(401).json({ error: 'Your session has expired. Sign in again.' });
    return;
  }

  // ---- what they are asking for ----
  var body = req.body || {};
  var to = typeof body.to === 'string' ? body.to.trim().toLowerCase() : '';
  var note = typeof body.note === 'string' ? body.note.trim().slice(0, MAX_NOTE) : '';
  // strip control characters: fromName goes into the Subject header, and a
  // newline in a header value is the classic header-injection trick
  var fromName = typeof body.fromName === 'string'
    ? body.fromName.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, 60) : '';

  if (!looksLikeEmail(to)) {
    res.status(400).json({ error: 'That does not look like an email address.' });
    return;
  }
  if (caller.email && to === String(caller.email).toLowerCase()) {
    res.status(400).json({ error: 'That is your own address. Try a friend instead.' });
    return;
  }
  if (!fromName) fromName = 'A Turnstiles passholder';

  // ---- daily cap ----
  // Read and write as the caller, using their own token, so RLS is what
  // scopes this to their rows. public.invites has no update or delete
  // policy, so nobody can clear their history to reset the count.
  var restHeaders = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json'
  };
  var since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    var countRes = await fetch(
      SUPABASE_URL + '/rest/v1/invites?select=id&created_at=gte.' + encodeURIComponent(since) +
      '&limit=' + (DAILY_LIMIT + 1),
      { headers: restHeaders }
    );
    if (!countRes.ok) {
      var cErr = await countRes.text();
      console.error('invite: count failed:', countRes.status, cErr);
      res.status(500).json({ error: 'Invites are not set up yet. Try again later.' });
      return;
    }
    var recent = await countRes.json();
    if (Array.isArray(recent) && recent.length >= DAILY_LIMIT) {
      res.status(429).json({ error: 'You have sent ' + DAILY_LIMIT + ' invites today. Try again tomorrow.' });
      return;
    }
  } catch (e) {
    console.error('invite: count error:', e);
    res.status(500).json({ error: 'Could not send that invite. Try again.' });
    return;
  }

  // Logged before the send, not after. An invite that fails at Resend still
  // counts against the cap, which is the safe direction to be wrong in.
  try {
    var logRes = await fetch(SUPABASE_URL + '/rest/v1/invites', {
      method: 'POST',
      headers: restHeaders,
      body: JSON.stringify({ inviter_id: caller.id, email: to })
    });
    if (!logRes.ok) {
      var lErr = await logRes.text();
      console.error('invite: log failed:', logRes.status, lErr);
      res.status(500).json({ error: 'Could not send that invite. Try again.' });
      return;
    }
  } catch (e) {
    console.error('invite: log error:', e);
    res.status(500).json({ error: 'Could not send that invite. Try again.' });
    return;
  }

  // ---- send ----
  var noteHtml = note
    ? '<tr><td style="padding:0 0 22px 34px;padding-right:34px"><div style="border-left:3px solid #C29A2C;' +
      'background:#F6EBCF;padding:12px 16px;border-radius:0 6px 6px 0;font-size:15px;line-height:1.55;' +
      'color:#2C4257;font-style:italic">' + esc(note).replace(/\n/g, '<br>') + '</div></td></tr>'
    : '';

  var html =
    '<div style="margin:0;padding:28px 12px;background:#142636;font-family:Helvetica,Arial,sans-serif">' +
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ' +
      'style="max-width:520px;margin:0 auto;background:#F2E7CE;border-radius:12px;overflow:hidden">' +
      '<tr><td style="height:4px;background:#C29A2C;font-size:0;line-height:0">&nbsp;</td></tr>' +
      '<tr><td style="padding:34px 34px 0">' +
        '<div style="font-size:11px;font-weight:bold;letter-spacing:2.4px;text-transform:uppercase;' +
          'color:#C29A2C;margin-bottom:14px">Turnstiles</div>' +
        '<h1 style="margin:0 0 16px;font-size:26px;line-height:1.2;color:#1A2A3A">' +
          esc(fromName) + ' invited you to Turnstiles.</h1>' +
      '</td></tr>' +
      '<tr><td style="padding:0 34px 22px">' +
        '<p style="margin:0;font-size:16px;line-height:1.6;color:#2C4257">' +
          'Turnstiles is where Orlando passholders keep track of their park days. ' +
          'Log your visits, rate the food, compare wait times, and climb the leaderboard.</p>' +
      '</td></tr>' +
      noteHtml +
      '<tr><td style="padding:0 34px 30px">' +
        '<a href="' + SITE_URL + '" style="display:inline-block;background:#1E354E;color:#F2E7CE;' +
          'text-decoration:none;font-size:14px;font-weight:bold;letter-spacing:1.4px;' +
          'text-transform:uppercase;padding:14px 30px;border-radius:6px">Create your account</a>' +
      '</td></tr>' +
      '<tr><td style="padding:16px 34px 26px;border-top:1px solid #D8C39A">' +
        '<p style="margin:0;font-size:12px;line-height:1.6;color:#5F5340">' +
          'You got this because someone typed your address into Turnstiles. ' +
          'No account has been created for you. Ignore this email and nothing happens.</p>' +
      '</td></tr>' +
    '</table></div>';

  var text =
    fromName + ' invited you to Turnstiles.\n\n' +
    'Turnstiles is where Orlando passholders keep track of their park days. ' +
    'Log your visits, rate the food, compare wait times, and climb the leaderboard.\n\n' +
    (note ? '"' + note + '"\n\n' : '') +
    'Create your account: ' + SITE_URL + '\n\n' +
    'You got this because someone typed your address into Turnstiles. ' +
    'No account has been created for you. Ignore this email and nothing happens.';

  try {
    var emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Turnstiles <notify@goturnstiles.com>',
        to: to,
        subject: fromName + ' invited you to Turnstiles',
        html: html,
        text: text
      })
    });
    if (!emailRes.ok) {
      var errText = await emailRes.text();
      console.error('invite: Resend error:', emailRes.status, errText);
      res.status(502).json({ error: 'The invite could not be delivered to that address.' });
      return;
    }
  } catch (e) {
    console.error('invite: send error:', e);
    res.status(500).json({ error: 'Could not send that invite. Try again.' });
    return;
  }

  res.status(200).json({ ok: true });
};
