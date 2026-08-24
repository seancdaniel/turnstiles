// Turnstiles - new-signup email notification.
//
// Called by a Supabase Database Webhook (Database -> Webhooks in the
// Supabase dashboard) configured on the `profiles` table, INSERT event
// only. handle_new_user() inserts exactly one profiles row per real new
// signup (see supabase/schema.sql), so this fires once per new account,
// never on login/edits.
//
// Needs three Vercel environment variables (Project Settings ->
// Environment Variables - never commit these):
//   RESEND_API_KEY        - from the Resend dashboard (same account
//                            already verified for goturnstiles.com)
//   NOTIFY_EMAIL           - where the notification email should land
//   SIGNUP_WEBHOOK_SECRET   - a random string you make up; set the same
//                            value as a custom header on the Supabase
//                            webhook (header name: x-webhook-secret) so
//                            this endpoint can tell a real webhook call
//                            apart from a random request hitting the URL
//
// This endpoint is publicly reachable (all Vercel URLs are), which is
// exactly why the secret header check below isn't optional.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  var secret = req.headers['x-webhook-secret'];
  if (!secret || secret !== process.env.SIGNUP_WEBHOOK_SECRET) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  var record = req.body && req.body.record;
  if (!record) {
    res.status(400).json({ error: 'no record in payload' });
    return;
  }

  var username = record.username || 'someone';
  var firstName = record.first_name || '';
  var whoLine = firstName ? firstName + ' (@' + username + ')' : '@' + username;

  try {
    var emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Turnstiles <notify@goturnstiles.com>',
        to: process.env.NOTIFY_EMAIL,
        subject: 'New Turnstiles signup: ' + username,
        html: '<p>' + whoLine + ' just signed up for Turnstiles.</p>'
      })
    });

    if (!emailRes.ok) {
      var errText = await emailRes.text();
      console.error('Resend error:', emailRes.status, errText);
      res.status(502).json({ error: 'email send failed' });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('notify-signup error:', e);
    res.status(500).json({ error: 'internal error' });
  }
};
