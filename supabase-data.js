/* Turnstiles - Supabase data layer (real reads + writes; overrides demo) */

// drop the demo seed; we use real data now
STATE.users = []; STATE.checkins = []; STATE.foodReviews = []; STATE.photos = [];

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

function rerenderActive() {
  var active = document.querySelector('.screen.active');
  if (!active) return;
  var id = active.id;
  if (id === 'view-home' && STATE.currentUser) { updatePassport(); updateParkCounts(); renderRecentActivity(); }
  if (id === 'view-community') renderCommunity();
  if (id === 'view-food') renderFood();
  if (id === 'view-photos') renderPhotos();
  if (id === 'view-profile' && STATE.currentUser) renderProfile();
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
  updatePassport(); updateParkCounts(); renderRecentActivity();
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
  var score = parseFloat(document.getElementById('ci-score').value) || 8.5;
  var review = document.getElementById('ci-review').value.trim();
  var foods = Array.prototype.slice.call(document.querySelectorAll('#ci-food-tags .food-tag-item')).map(function (t) { return t.textContent.replace('\u{1F37D}', '').replace('✕', '').trim(); }).filter(Boolean);
  var uid = STATE.currentUser.id;
  var res = await sb.from('checkins').insert({ user_id: uid, park: park, visit_date: date, miles: miles, score: score, review: review, foods: foods });
  if (res.error) { toast('Could not save check-in: ' + res.error.message, 'error'); return; }
  if (foods.length) {
    await sb.from('food_reviews').insert(foods.map(function (f) { return { user_id: uid, item_name: f, park: park, score: score, review: review }; }));
  }
  var photoImg = document.getElementById('ci-photo-img');
  if (photoImg && photoImg.src && photoImg.src.indexOf('data:') === 0) {
    var small = await downscale(photoImg.src);
    await sb.from('photos').insert({ user_id: uid, park: park, caption: review || ('Check-in at ' + park), image_url: small });
  }
  closeOverlay('overlay-checkin');
  document.getElementById('ci-miles').value = '';
  document.getElementById('ci-food-tags').innerHTML = '';
  document.getElementById('ci-review').value = '';
  document.getElementById('ci-score').value = 8.5;
  document.getElementById('ci-score-display').textContent = '8.5 / 10';
  document.getElementById('ci-photo-preview').style.display = 'none';
  document.getElementById('ci-photo-input').value = '';
  document.getElementById('ci-date').valueAsDate = new Date();
  await loadData();
  showView('home');
  toast('Check-in at ' + park + ' logged!');
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
  if (img && img.src && img.src.indexOf('data:') === 0) url = await downscale(img.src);
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
