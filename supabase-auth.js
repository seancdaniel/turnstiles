/* Turnstiles - Supabase auth (overrides the demo auth in main.js) */

function profileToUser(p, email) {
  return {
    id: p.id, username: p.username,
    fname: p.first_name || '', lname: p.last_name || '',
    email: email || '', avatar: p.avatar || '\u{1F3A2}',
    bio: p.bio || '', location: p.location || '',
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
  document.getElementById('nav-avatar').textContent = user.avatar;
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
  const { data, error } = await sb.auth.signUp({
    email: email, password: pass,
    options: { data: { username: username, first_name: fname, last_name: lname, avatar: selectedAvatar } }
  });
  if (error) { toast(error.message, 'error'); return; }
  if (data.user) {
    await sb.from('profiles').update({ bio: bio || 'Theme park enthusiast.', location: loc }).eq('id', data.user.id);
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
function checkPasswordStrength() {
  const pass = document.getElementById('reg-pass').value;
  const checks = {
    len: pass.length >= 10,
    lower: /[a-z]/.test(pass),
    upper: /[A-Z]/.test(pass),
    digit: /[0-9]/.test(pass),
    symbol: /[^A-Za-z0-9]/.test(pass)
  };
  Object.keys(checks).forEach(k => {
    const el = document.querySelector('#reg-pass-reqs .pw-req[data-req="' + k + '"]');
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

function editPickAvatar(el) {
  document.querySelectorAll('#edit-avatar-picker .avatar-opt').forEach(a => a.classList.remove('selected'));
  el.classList.add('selected');
  editSelectedAvatar = el.dataset.emoji;
}

function openEditProfile() {
  const u = STATE.currentUser; if (!u) return;
  editSelectedAvatar = u.avatar;
  document.querySelectorAll('#edit-avatar-picker .avatar-opt').forEach(a => {
    a.classList.toggle('selected', a.dataset.emoji === u.avatar);
  });
  document.getElementById('ep-fname').value = u.fname || '';
  document.getElementById('ep-lname').value = u.lname || '';
  document.getElementById('ep-username').value = u.username || '';
  document.getElementById('ep-bio').value = u.bio || '';
  document.getElementById('ep-location').value = u.location || '';
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
  const err = document.getElementById('ep-user-err');
  err.classList.remove('show');
  if (!fname || !username) { toast('First name and username are required.', 'error'); return; }
  if (username !== u.username) {
    const { data: taken } = await sb.from('profiles').select('id').eq('username', username).maybeSingle();
    if (taken) { err.classList.add('show'); return; }
  }
  const { error } = await sb.from('profiles').update({
    first_name: fname, last_name: lname, username: username,
    avatar: editSelectedAvatar || u.avatar, bio: bio, location: location
  }).eq('id', u.id);
  if (error) { toast('Could not save: ' + error.message, 'error'); return; }
  STATE.currentUser = Object.assign({}, u, {
    fname: fname, lname: lname, username: username,
    avatar: editSelectedAvatar || u.avatar, bio: bio, location: location
  });
  document.getElementById('nav-avatar').textContent = STATE.currentUser.avatar;
  document.getElementById('nav-username').textContent = STATE.currentUser.username;
  closeOverlay('overlay-edit-profile');
  await loadData();
  showView('profile');
  toast('Profile updated!');
}

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
