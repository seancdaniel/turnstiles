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
  renderRecentActivity();
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
    if (pass.length < 6) { toast('Password must be at least 6 characters.', 'error'); return; }
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
