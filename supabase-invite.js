// ============================================================
// INVITE A FRIEND
// ============================================================
// "Invite a Friend" in the profile dropdown. The actual send happens in
// api/invite.js, because the Resend key has to stay on the server. This
// side only collects the address and hands over the caller's Supabase
// access token so the endpoint can prove who is asking.

var INVITE_LINK = 'https://goturnstiles.com';

function openInvite() {
  if (!STATE.currentUser) { openOverlay('overlay-signin'); return; }
  document.getElementById('inv-email').value = '';
  document.getElementById('inv-note').value = '';
  document.getElementById('inv-err').classList.remove('show');
  var copy = document.getElementById('inv-copy');
  if (copy) copy.innerHTML = '<i class="ti ti-copy"></i> Copy';
  openOverlay('overlay-invite');
  setTimeout(function () { document.getElementById('inv-email').focus(); }, 60);
}

function inviteError(msg) {
  var el = document.getElementById('inv-err');
  el.textContent = msg;
  el.classList.add('show');
}

// clipboard for anyone who would rather paste the link into a text message
async function copyInviteLink(btn) {
  try {
    await navigator.clipboard.writeText(INVITE_LINK);
    btn.innerHTML = '<i class="ti ti-circle-check"></i> Copied';
    setTimeout(function () { btn.innerHTML = '<i class="ti ti-copy"></i> Copy'; }, 1800);
  } catch (e) {
    // clipboard is blocked on insecure origins and in some mobile browsers,
    // so fall back to selecting the text and letting them copy it themselves
    var f = document.getElementById('inv-link');
    if (f) { f.removeAttribute('readonly'); f.select(); f.setAttribute('readonly', 'readonly'); }
    toast('Press copy on your keyboard to grab the link.', 'info');
  }
}

async function submitInvite(btn) {
  if (!STATE.currentUser) { openOverlay('overlay-signin'); return; }
  if (btn && btn.disabled) return; // same double-click guard as submitCheckin
  document.getElementById('inv-err').classList.remove('show');

  var to = document.getElementById('inv-email').value.trim();
  var note = document.getElementById('inv-note').value.trim();
  if (!to) { inviteError('Enter the email address you want to invite.'); return; }
  if (to.indexOf('@') < 0 || to.indexOf('.') < 0) {
    inviteError('That does not look like an email address.');
    return;
  }

  var label = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
  try {
    var session = await sb.auth.getSession();
    var token = session && session.data && session.data.session
      ? session.data.session.access_token : null;
    if (!token) { inviteError('Your session has expired. Sign in again.'); return; }

    var who = STATE.currentUser.fname || STATE.currentUser.username || '';

    var res = await fetch('/api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ to: to, note: note, fromName: who })
    });

    // a non-JSON body means the function itself fell over, so do not try to
    // read an error message out of it
    var out = null;
    try { out = await res.json(); } catch (e) { out = null; }

    if (!res.ok) {
      inviteError((out && out.error) || 'Could not send that invite. Try again.');
      return;
    }

    closeOverlay('overlay-invite');
    toast('Invite sent to ' + to + '!');
  } catch (e) {
    console.log('invite error:', e);
    inviteError('Could not send that invite. Try again.');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = label; }
  }
}
