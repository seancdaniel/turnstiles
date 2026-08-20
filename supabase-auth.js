/* Turnstiles - Supabase auth (overrides the demo auth in main.js) */

// letters, numbers, underscore, period only - keeps usernames unambiguous and closes off
// the character set that made the unescaped-render bug (fixed in main.js) exploitable
// in the first place. Defense in depth: validate on the way in, escape on the way out.
function isValidUsername(u) { return /^[A-Za-z0-9_.]{3,20}$/.test(u); }

function profileToUser(p, email) {
  return {
    id: p.id, username: p.username,
    fname: p.first_name || '', lname: p.last_name || '',
    email: email || '', avatar: p.avatar || '\u{1F3A2}', avatarUrl: p.avatar_url || '',
    bio: p.bio || '', location: p.location || '',
    disneyPass: p.disney_pass || '', universalPass: p.universal_pass || '',
    parks: [], joinYear: p.join_year || new Date().getFullYear()
  };
}

async function fetchProfile(userId) {
  const { data, error } = await sb.from('profiles').select('*').eq('id', userId).single();
  if (error) { console.log('profile fetch error:', error.message); return null; }
  return data;
}

function enterApp(user) {
  STATE.currentUser = user;
  document.body.classList.remove('guest');
  document.getElementById('nav-avatar').innerHTML = avatarHtml(user.avatarUrl, user.avatar);
  document.getElementById('nav-username').textContent = user.username;
  document.getElementById('landing-shell').style.display = 'none';
  document.getElementById('app-shell').style.display = 'block';
  updatePassport();
  updateParkCounts();
  showView('home');
}

async function doSignIn() {
  const email = document.getElementById('signin-user').value.trim();
  const pass = document.getElementById('signin-pass').value;
  const err = document.getElementById('signin-err');
  err.classList.remove('show');
  if (!email || !pass) { err.textContent = 'Enter your email and password.'; err.classList.add('show'); return; }
  const { data, error } = await sb.auth.signInWithPassword({ email: email, password: pass });
  if (error) { err.textContent = error.message; err.classList.add('show'); return; }
  const profile = await fetchProfile(data.user.id);
  if (!profile) { err.textContent = 'Signed in, but could not load your profile.'; err.classList.add('show'); return; }
  closeOverlay('overlay-signin');
  enterApp(profileToUser(profile, data.user.email));
  toast('Welcome back, ' + (profile.first_name || profile.username) + '!');
}

async function regSubmit() {
  const fname = document.getElementById('reg-fname').value.trim();
  const lname = document.getElementById('reg-lname').value.trim();
  const username = document.getElementById('reg-username').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass = document.getElementById('reg-pass').value;
  const bio = document.getElementById('reg-bio').value.trim();
  const loc = document.getElementById('reg-location').value.trim();
  const disneyPass = document.getElementById('reg-disney-pass').value;
  const universalPass = document.getElementById('reg-universal-pass').value;
  const { data, error } = await sb.auth.signUp({
    email: email, password: pass,
    // bio/location/pass fields travel as signup metadata (like username/first_name) so
    // the handle_new_user() trigger can write them straight into the new profile row.
    // A follow-up client-side update() can't be relied on here: with email
    // confirmation ON there's no session yet at this point, so RLS would just
    // silently drop the update (0 rows matched, no error) - see schema.sql.
    options: { data: { username: username, first_name: fname, last_name: lname, avatar: selectedAvatar, bio: bio || 'Theme park enthusiast.', location: loc, disney_pass: disneyPass, universal_pass: universalPass } }
  });
  if (error) { toast(error.message, 'error'); return; }
  // only attempt the avatar Storage upload if we actually have a session (email confirmation
  // could be on, in which case there's no session yet and the upload would just fail RLS)
  if (data.user && regAvatarMode === 'photo' && data.session) {
    const previewSrc = document.getElementById('reg-avatar-preview-img').getAttribute('src');
    if (previewSrc && previewSrc.indexOf('data:') === 0) {
      const small = await downscale(previewSrc);
      const url = await uploadPhoto(small, data.user.id);
      if (url) await sb.from('profiles').update({ avatar_url: url }).eq('id', data.user.id);
    }
  }
  if (!data.session) { closeOverlay('overlay-register'); resetRegForm(); toast('Account created! Check your email to confirm, then sign in.'); return; }
  const profile = await fetchProfile(data.user.id);
  closeOverlay('overlay-register');
  resetRegForm();
  enterApp(profileToUser(profile || { id: data.user.id, username: username, first_name: fname, avatar: selectedAvatar }, email));
  toast('Welcome to Turnstiles, ' + fname + '!');
}

// Mirrors the Supabase Auth password policy (Settings -> Minimum password length /
// Password requirements). Keep these two in sync if that policy ever changes.
function checkPasswordStrength(inputId, reqsId) {
  inputId = inputId || 'reg-pass'; reqsId = reqsId || 'reg-pass-reqs';
  const pass = document.getElementById(inputId).value;
  const checks = {
    len: pass.length >= 10,
    lower: /[a-z]/.test(pass),
    upper: /[A-Z]/.test(pass),
    digit: /[0-9]/.test(pass),
    symbol: /[^A-Za-z0-9]/.test(pass)
  };
  Object.keys(checks).forEach(k => {
    const el = document.querySelector('#' + reqsId + ' .pw-req[data-req="' + k + '"]');
    if (el) el.classList.toggle('met', checks[k]);
  });
  return checks;
}

async function regNext() {
  const err = document.getElementById('reg-user-err');
  const perr = document.getElementById('reg-pass-err');
  err.classList.remove('show'); perr.classList.remove('show');
  if (regStep === 1) {
    const fname = document.getElementById('reg-fname').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const pass = document.getElementById('reg-pass').value;
    const pass2 = document.getElementById('reg-pass2').value;
    if (!fname || !username || !email || !pass) { toast('Please fill in all required fields.', 'error'); return; }
    if (!isValidUsername(username)) { toast('Username must be 3-20 characters: letters, numbers, underscores, or periods only.', 'error'); return; }
    if (pass !== pass2) { perr.classList.add('show'); return; }
    const strength = checkPasswordStrength();
    if (!Object.keys(strength).every(k => strength[k])) { toast('Password does not meet the requirements below.', 'error'); return; }
    const { data: taken } = await sb.from('profiles').select('id').eq('username', username).maybeSingle();
    if (taken) { err.classList.add('show'); return; }
    regStep = 2;
    document.getElementById('reg-page-1').style.display = 'none';
    document.getElementById('reg-page-2').style.display = 'block';
    document.getElementById('reg-step-1').className = 'step-item done';
    document.getElementById('reg-step-2').className = 'step-item active';
    document.getElementById('reg-back-btn').style.display = 'block';
  } else if (regStep === 2) {
    regStep = 3;
    document.getElementById('reg-page-2').style.display = 'none';
    document.getElementById('reg-page-3').style.display = 'block';
    document.getElementById('reg-step-2').className = 'step-item done';
    document.getElementById('reg-step-3').className = 'step-item active';
    document.getElementById('reg-next-btn').textContent = 'Create Account';
  } else if (regStep === 3) {
    regSubmit();
  }
}

// Edit profile (overrides the prompt()-based demo version in main.js)
var editSelectedAvatar = null;
var epAvatarMode = 'emoji'; // 'emoji' | 'photo' - whichever the user last interacted with

function editPickAvatar(el) {
  document.querySelectorAll('#edit-avatar-picker .avatar-opt').forEach(a => a.classList.remove('selected'));
  el.classList.add('selected');
  editSelectedAvatar = el.dataset.emoji;
  epAvatarMode = 'emoji';
  document.getElementById('ep-avatar-preview').style.display = 'none';
}

function handleEpAvatarPhoto(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = r => {
    epAvatarMode = 'photo';
    document.getElementById('ep-avatar-preview').style.display = 'block';
    document.getElementById('ep-avatar-preview-img').src = r.target.result;
  };
  reader.readAsDataURL(file);
}

function openEditProfile() {
  const u = STATE.currentUser; if (!u) return;
  editSelectedAvatar = u.avatar;
  document.querySelectorAll('#edit-avatar-picker .avatar-opt').forEach(a => {
    a.classList.toggle('selected', a.dataset.emoji === u.avatar);
  });
  const preview = document.getElementById('ep-avatar-preview');
  const previewImg = document.getElementById('ep-avatar-preview-img');
  document.getElementById('ep-avatar-file').value = '';
  if (u.avatarUrl) {
    epAvatarMode = 'photo';
    previewImg.src = u.avatarUrl;
    preview.style.display = 'block';
  } else {
    epAvatarMode = 'emoji';
    previewImg.removeAttribute('src');
    preview.style.display = 'none';
  }
  document.getElementById('ep-fname').value = u.fname || '';
  document.getElementById('ep-lname').value = u.lname || '';
  document.getElementById('ep-username').value = u.username || '';
  document.getElementById('ep-bio').value = u.bio || '';
  document.getElementById('ep-location').value = u.location || '';
  document.getElementById('ep-disney-pass').value = u.disneyPass || '';
  document.getElementById('ep-universal-pass').value = u.universalPass || '';
  document.getElementById('ep-user-err').classList.remove('show');
  openOverlay('overlay-edit-profile');
}

async function submitEditProfile() {
  const u = STATE.currentUser; if (!u) return;
  const fname = document.getElementById('ep-fname').value.trim();
  const lname = document.getElementById('ep-lname').value.trim();
  const username = document.getElementById('ep-username').value.trim();
  const bio = document.getElementById('ep-bio').value.trim();
  const location = document.getElementById('ep-location').value.trim();
  const disneyPass = document.getElementById('ep-disney-pass').value;
  const universalPass = document.getElementById('ep-universal-pass').value;
  const err = document.getElementById('ep-user-err');
  err.classList.remove('show');
  if (!fname || !username) { toast('First name and username are required.', 'error'); return; }
  if (!isValidUsername(username)) { toast('Username must be 3-20 characters: letters, numbers, underscores, or periods only.', 'error'); return; }
  if (username !== u.username) {
    const { data: taken } = await sb.from('profiles').select('id').eq('username', username).maybeSingle();
    if (taken) { err.classList.add('show'); return; }
  }

  // resolve the avatar photo: new upload, keep existing, or clear (emoji mode)
  let avatarUrl = null;
  if (epAvatarMode === 'photo') {
    const previewSrc = document.getElementById('ep-avatar-preview-img').getAttribute('src');
    if (previewSrc && previewSrc.indexOf('data:') === 0) {
      const small = await downscale(previewSrc);
      avatarUrl = await uploadPhoto(small, u.id);
      if (!avatarUrl) { toast('Could not upload photo - profile not saved.', 'error'); return; }
    } else if (previewSrc) {
      avatarUrl = previewSrc; // unchanged existing photo
    }
  }

  const { error } = await sb.from('profiles').update({
    first_name: fname, last_name: lname, username: username,
    avatar: editSelectedAvatar || u.avatar, avatar_url: avatarUrl, bio: bio, location: location,
    disney_pass: disneyPass, universal_pass: universalPass
  }).eq('id', u.id);
  if (error) { toast('Could not save: ' + error.message, 'error'); return; }
  STATE.currentUser = Object.assign({}, u, {
    fname: fname, lname: lname, username: username,
    avatar: editSelectedAvatar || u.avatar, avatarUrl: avatarUrl || '', bio: bio, location: location,
    disneyPass: disneyPass, universalPass: universalPass
  });
  document.getElementById('nav-avatar').innerHTML = avatarHtml(STATE.currentUser.avatarUrl, STATE.currentUser.avatar);
  document.getElementById('nav-username').textContent = STATE.currentUser.username;
  closeOverlay('overlay-edit-profile');
  await loadData();
  showView('profile');
  toast('Profile updated!');
}

function openForgotPassword() {
  closeOverlay('overlay-signin');
  const signinEmail = document.getElementById('signin-user');
  document.getElementById('fp-email').value = signinEmail ? signinEmail.value.trim() : '';
  document.getElementById('fp-err').classList.remove('show');
  openOverlay('overlay-forgot-password');
}

async function submitForgotPassword() {
  const email = document.getElementById('fp-email').value.trim();
  const err = document.getElementById('fp-err');
  err.classList.remove('show');
  if (!email) { err.textContent = 'Enter your email address.'; err.classList.add('show'); return; }
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  if (error) { err.textContent = error.message; err.classList.add('show'); return; }
  closeOverlay('overlay-forgot-password');
  toast('If that email has an account, a reset link is on its way.');
}

// true when overlay-change-password was opened by clicking a reset-link email rather than
// from Edit Profile - there's no prior session to fall back to, so cancelling isn't offered
var cpRecoveryMode = false;
function openChangePassword() {
  cpRecoveryMode = false;
  document.getElementById('cp-title').textContent = 'Change Password';
  document.getElementById('cp-close').style.display = '';
  document.getElementById('cp-cancel').style.display = '';
  document.getElementById('cp-pass').value = '';
  document.getElementById('cp-pass2').value = '';
  document.getElementById('cp-err').classList.remove('show');
  document.querySelectorAll('#cp-pass-reqs .pw-req').forEach(el => el.classList.remove('met'));
  closeOverlay('overlay-edit-profile');
  openOverlay('overlay-change-password');
}

async function submitChangePassword() {
  const pass = document.getElementById('cp-pass').value;
  const pass2 = document.getElementById('cp-pass2').value;
  const err = document.getElementById('cp-err');
  err.classList.remove('show');
  if (pass !== pass2) { err.textContent = 'Passwords do not match.'; err.classList.add('show'); return; }
  const strength = checkPasswordStrength('cp-pass', 'cp-pass-reqs');
  if (!Object.keys(strength).every(k => strength[k])) { toast('Password does not meet the requirements above.', 'error'); return; }
  const { error } = await sb.auth.updateUser({ password: pass });
  if (error) { err.textContent = error.message; err.classList.add('show'); return; }
  closeOverlay('overlay-change-password');
  toast('Password updated!');
  if (cpRecoveryMode) {
    cpRecoveryMode = false;
    // the recovery link left them with a real session - load the profile and drop them
    // into the app the same way a normal sign-in does
    const { data } = await sb.auth.getSession();
    if (data && data.session) {
      const profile = await fetchProfile(data.session.user.id);
      if (profile) enterApp(profileToUser(profile, data.session.user.email));
    }
  }
}

// clicking a password-reset email link lands back here with a recovery session -
// catch that and force the "set a new password" modal open, no way to dismiss it
// without a session to fall back to
sb.auth.onAuthStateChange(function (event) {
  if (event === 'PASSWORD_RECOVERY') {
    cpRecoveryMode = true;
    document.getElementById('cp-title').textContent = 'Set a New Password';
    document.getElementById('cp-close').style.display = 'none';
    document.getElementById('cp-cancel').style.display = 'none';
    document.getElementById('cp-pass').value = '';
    document.getElementById('cp-pass2').value = '';
    document.getElementById('cp-err').classList.remove('show');
    document.querySelectorAll('#cp-pass-reqs .pw-req').forEach(el => el.classList.remove('met'));
    openOverlay('overlay-change-password');
  }
});

async function doSignOut() {
  await sb.auth.signOut();
  STATE.currentUser = null;
  document.getElementById('app-shell').style.display = 'none';
  document.getElementById('landing-shell').style.display = 'block';
  closeDropdown();
  toast('Signed out. See you next visit!', 'info');
}

(async function restoreSession() {
  try {
    const { data } = await sb.auth.getSession();
    if (data && data.session) {
      const profile = await fetchProfile(data.session.user.id);
      if (profile) enterApp(profileToUser(profile, data.session.user.email));
    }
  } catch (e) { console.log('session restore error:', e); }
})();
