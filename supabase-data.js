/* Turnstiles - Supabase data layer (real reads + writes; overrides demo) */

// drop the demo seed; we use real data now
STATE.users = []; STATE.checkins = []; STATE.foodReviews = []; STATE.photos = []; STATE.foodFavorites = [];

function downscale(dataUrl, max) {
  max = max || 1000;
  return new Promise(function (resolve) {
    var img = new Image();
    img.onload = function () {
      var w = img.width, h = img.height;
      if (w > max || h > max) { if (w > h) { h = Math.round(h * max / w); w = max; } else { w = Math.round(w * max / h); h = max; } }
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = function () { resolve(dataUrl); };
    img.src = dataUrl;
  });
}

// upload a downscaled data URL to the "photos" Storage bucket; returns a public URL (or null on failure)
async function uploadPhoto(dataUrl, userId) {
  try {
    var blob = await (await fetch(dataUrl)).blob();
    var path = userId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.jpg';
    var up = await sb.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' });
    if (up.error) { console.log('photo upload error:', up.error.message); return null; }
    return sb.storage.from('photos').getPublicUrl(path).data.publicUrl;
  } catch (e) { console.log('photo upload error:', e); return null; }
}

// read-only view of another passholder's profile (or your own -> jump to the real editable page)
function openUserProfile(userId) {
  if (STATE.currentUser && userId === STATE.currentUser.id) { showView('profile'); return; }
  var u = STATE.users.find(function (x) { return x.id === userId; });
  if (!u) return;

  var my = STATE.checkins.filter(function (c) { return c.userId === userId; });
  var miles = my.reduce(function (s, c) { return s + (c.miles || 0); }, 0);
  var foods = [];
  var seenFood = {};
  my.forEach(function (c) { (c.foods || []).forEach(function (f) { if (!seenFood[f]) { seenFood[f] = true; foods.push(f); } }); });
  var scores = my.filter(function (c) { return c.score != null; }).map(function (c) { return c.score; });
  var avg = scores.length ? (scores.reduce(function (a, b) { return a + b; }, 0) / scores.length).toFixed(1) : '—';
  var tier = getTier(my.length);

  document.getElementById('up-avatar').textContent = u.avatar;
  document.getElementById('up-name').textContent = (u.fname + ' ' + (u.lname || '')).trim() || u.username;
  document.getElementById('up-username').textContent = '@' + u.username;
  document.getElementById('up-bio').textContent = u.bio || 'No bio yet.';
  document.getElementById('up-stat-visits').textContent = my.length;
  document.getElementById('up-stat-miles').textContent = miles.toFixed(1);
  document.getElementById('up-stat-foods').textContent = foods.length;
  document.getElementById('up-stat-avg').textContent = avg;

  var badges = [tier.name + ' Tier'];
  if (my.length >= 1) badges.push('First Visit');
  if (my.length >= 10) badges.push('Regular');
  if (my.length >= 50) badges.push('Gold Passholder');
  var parkSet = {}; my.forEach(function (c) { parkSet[c.park] = true; });
  if (Object.keys(parkSet).length >= 4) badges.push('Park Hopper');
  if (foods.length >= 10) badges.push('Foodie');
  document.getElementById('up-badges').innerHTML = badges.map(function (b) {
    var gold = /Gold|Park|Foodie/.test(b) ? ' gold' : '';
    return '<span class="badge' + gold + '">' + escapeHtml(b) + '</span>';
  }).join('');

  var visitsEl = document.getElementById('up-visits');
  var recent = my.slice().sort(function (a, b) { return b.ts - a.ts; }).slice(0, 10);
  if (!recent.length) {
    visitsEl.innerHTML = '<div class="empty-state"><div class="empty-state-sub">No visits logged yet.</div></div>';
  } else {
    visitsEl.innerHTML = '<table class="visit-table"><thead><tr><th>Park</th><th>Date</th><th>Miles</th><th>Food Score</th></tr></thead><tbody>' +
      recent.map(function (c) {
        return '<tr><td>' + parkEmoji(c.park) + ' ' + escapeHtml(c.park) + '</td><td>' + formatDate(c.date) + '</td><td>' + (c.miles ? c.miles + ' mi' : '—') + '</td><td>' + (c.score ? '<span class="visit-tag">' + c.score.toFixed(1) + '/10</span>' : '—') + '</td></tr>';
      }).join('') + '</tbody></table>';
  }

  var reviewsEl = document.getElementById('up-food-reviews');
  var myReviews = STATE.foodReviews.filter(function (r) { return r.userId === userId; });
  if (!myReviews.length) {
    reviewsEl.innerHTML = '<div class="empty-state"><div class="empty-state-sub">No food reviews yet.</div></div>';
  } else {
    reviewsEl.innerHTML = myReviews.map(function (r) {
      var loc = r.park + (r.spot ? ' · ' + r.spot : '');
      return '<div class="myfr-row">' +
        '<div class="myfr-emoji">' + foodEmoji(r.itemName) + '</div>' +
        '<div class="myfr-info"><div class="myfr-name">' + escapeHtml(r.itemName) + '</div><div class="myfr-loc">' + escapeHtml(loc) + '</div>' + (r.review ? '<div class="myfr-review">' + escapeHtml(r.review) + '</div>' : '') + '</div>' +
        '<div class="myfr-score">' + Number(r.score).toFixed(1) + '</div>' +
        '</div>';
    }).join('');
  }

  openOverlay('overlay-user-profile');
}

function rerenderActive() {
  var active = document.querySelector('.screen.active');
  if (!active) return;
  var id = active.id;
  if (id === 'view-home' && STATE.currentUser) { updatePassport(); updateParkCounts(); renderProfile(); }
  if (id === 'view-community') renderCommunity();
  if (id === 'view-food') renderFood();
  if (id === 'view-photos') renderPhotos();
}

async function loadData() {
  try {
    var r = await Promise.all([
      sb.from('profiles').select('*'),
      sb.from('checkins').select('*').order('created_at', { ascending: false }),
      sb.from('food_reviews').select('*').order('created_at', { ascending: false }),
      sb.from('photos').select('*').order('created_at', { ascending: false })
    ]);
    var profiles = r[0].data || [];
    var idMap = {};
    STATE.users = profiles.map(function (p) { var u = profileToUser(p); idMap[p.id] = u; return u; });
    STATE.checkins = (r[1].data || []).map(function (c) {
      return { id: c.id, userId: c.user_id, park: c.park, date: c.visit_date,
        miles: Number(c.miles) || 0, foods: c.foods || [],
        score: c.score != null ? Number(c.score) : null, review: c.review || '',
        verified: c.verified, ts: new Date(c.created_at).getTime() };
    });
    STATE.foodReviews = (r[2].data || []).map(function (f) {
      return { id: f.id, userId: f.user_id,
        username: (idMap[f.user_id] && idMap[f.user_id].username) || 'someone',
        itemName: f.item_name, park: f.park, score: Number(f.score),
        review: f.review || '', ts: new Date(f.created_at).getTime() };
    });
    STATE.photos = (r[3].data || []).map(function (ph) {
      return { id: ph.id, userId: ph.user_id,
        username: (idMap[ph.user_id] && idMap[ph.user_id].username) || 'someone',
        avatar: (idMap[ph.user_id] && idMap[ph.user_id].avatar) || '\u{1F3A2}',
        park: ph.park, caption: ph.caption || '', dataUrl: ph.image_url || null,
        ts: new Date(ph.created_at).getTime() };
    });
    rerenderActive();
  } catch (e) { console.log('loadData error:', e); }
}

function enterApp(user) {
  STATE.currentUser = user;
  document.body.classList.remove('guest');
  document.getElementById('nav-avatar').textContent = user.avatar;
  document.getElementById('nav-username').textContent = user.username;
  document.getElementById('landing-shell').style.display = 'none';
  document.getElementById('app-shell').style.display = 'block';
  updatePassport(); updateParkCounts();
  showView('home');
  loadData();
}

function guestBrowse(name) {
  STATE.currentUser = null;
  document.body.classList.add('guest');
  closeDropdown();
  document.getElementById('landing-shell').style.display = 'none';
  document.getElementById('app-shell').style.display = 'block';
  showView(name);
  loadData();
}

async function submitCheckin() {
  if (!STATE.currentUser) { openOverlay('overlay-register'); return; }
  var park = document.getElementById('ci-park').value;
  var date = document.getElementById('ci-date').value || new Date().toISOString().split('T')[0];
  var miles = parseFloat(document.getElementById('ci-miles').value) || 0;
  var review = document.getElementById('ci-review').value.trim();
  var uid = STATE.currentUser.id;
  var res = await sb.from('checkins').insert({ user_id: uid, park: park, visit_date: date, miles: miles, review: review });
  if (res.error) { toast('Could not save check-in: ' + res.error.message, 'error'); return; }
  var photoImg = document.getElementById('ci-photo-img');
  if (photoImg && photoImg.src && photoImg.src.indexOf('data:') === 0) {
    var small = await downscale(photoImg.src);
    var url = await uploadPhoto(small, uid);
    if (url) await sb.from('photos').insert({ user_id: uid, park: park, caption: review || ('Check-in at ' + park), image_url: url });
  }
  closeOverlay('overlay-checkin');
  document.getElementById('ci-miles').value = '';
  document.getElementById('ci-review').value = '';
  document.getElementById('ci-photo-preview').style.display = 'none';
  document.getElementById('ci-photo-input').value = '';
  document.getElementById('ci-date').valueAsDate = new Date();
  await loadData();
  showView('home');
  toast('Check-in at ' + park + ' logged!');
}

async function deleteCheckin(id) {
  if (!STATE.currentUser) return;
  if (!confirm('Delete this check-in? This cannot be undone.')) return;
  var res = await sb.from('checkins').delete().eq('id', id).eq('user_id', STATE.currentUser.id);
  if (res.error) { toast('Could not delete: ' + res.error.message, 'error'); return; }
  await loadData();
  showView('profile');
  toast('Check-in deleted.');
}

async function submitFoodReview() {
  if (!STATE.currentUser) { openOverlay('overlay-register'); return; }
  var name = document.getElementById('fr-name').value.trim();
  if (!name) { toast('Please enter a food item name.', 'error'); return; }
  var park = document.getElementById('fr-park').value;
  var score = parseFloat(document.getElementById('fr-score').value);
  var review = document.getElementById('fr-review').value.trim();
  var res = await sb.from('food_reviews').insert({ user_id: STATE.currentUser.id, item_name: name, park: park, score: score, review: review });
  if (res.error) { toast('Could not save: ' + res.error.message, 'error'); return; }
  closeOverlay('overlay-food-review');
  document.getElementById('fr-name').value = '';
  document.getElementById('fr-review').value = '';
  await loadData();
  showView('food');
  toast(name + ' rated ' + score.toFixed(1) + '/10!');
}

async function submitPhoto() {
  if (!STATE.currentUser) { openOverlay('overlay-register'); return; }
  var park = document.getElementById('ph-park').value;
  var caption = document.getElementById('ph-caption').value.trim();
  var img = document.getElementById('ph-preview-img');
  var url = null;
  if (img && img.src && img.src.indexOf('data:') === 0) {
    var small = await downscale(img.src);
    url = await uploadPhoto(small, STATE.currentUser.id);
  }
  var res = await sb.from('photos').insert({ user_id: STATE.currentUser.id, park: park, caption: caption || ('At ' + park), image_url: url });
  if (res.error) { toast('Could not share photo: ' + res.error.message, 'error'); return; }
  closeOverlay('overlay-photo');
  document.getElementById('ph-caption').value = '';
  document.getElementById('ph-preview').style.display = 'none';
  var phFile = document.getElementById('ph-file'); if (phFile) phFile.value = '';
  await loadData();
  showView('photos');
  toast('Photo shared with the community!');
}

// initial community load so guest browsing shows real data
loadData();
