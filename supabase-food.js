/* Turnstiles - food items: search-and-pick + spot, de-duplicated ratings */

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// full data load (overrides supabase-data.js loadData; adds `spot` to reviews)
var frEditId = null;

async function loadData() {
  try {
    var r = await Promise.all([
      sb.from('profiles').select('*'),
      sb.from('checkins').select('*').order('created_at', { ascending: false }),
      sb.from('food_reviews').select('*').order('created_at', { ascending: false }),
      sb.from('photos').select('*').order('created_at', { ascending: false }),
      sb.from('food_favorites').select('*').order('created_at', { ascending: false }),
      sb.from('wait_times').select('*').order('created_at', { ascending: false }),
      sb.from('donors').select('*').order('created_at', { ascending: false })
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
        avatar: (idMap[f.user_id] && idMap[f.user_id].avatar) || '\u{1F3A2}',
        avatarUrl: (idMap[f.user_id] && idMap[f.user_id].avatarUrl) || '',
        itemName: f.item_name, park: f.park, spot: f.spot || '', score: Number(f.score),
        review: f.review || '', photoUrl: f.photo_url || '', ts: new Date(f.created_at).getTime() };
    });
    STATE.photos = (r[3].data || []).map(function (ph) {
      return { id: ph.id, userId: ph.user_id,
        username: (idMap[ph.user_id] && idMap[ph.user_id].username) || 'someone',
        avatar: (idMap[ph.user_id] && idMap[ph.user_id].avatar) || '\u{1F3A2}',
        avatarUrl: (idMap[ph.user_id] && idMap[ph.user_id].avatarUrl) || '',
        park: ph.park, caption: ph.caption || '', dataUrl: ph.image_url || null,
        ts: new Date(ph.created_at).getTime() };
    });
    STATE.foodFavorites = (r[4].data || []).map(function (f) {
      return { id: f.id, userId: f.user_id, itemName: f.item_name, park: f.park,
        spot: f.spot || '', ts: new Date(f.created_at).getTime() };
    });
    STATE.waitTimes = (r[5].data || []).map(function (w) {
      return { id: w.id, userId: w.user_id,
        username: (idMap[w.user_id] && idMap[w.user_id].username) || 'someone',
        avatar: (idMap[w.user_id] && idMap[w.user_id].avatar) || '\u{1F3A2}',
        avatarUrl: (idMap[w.user_id] && idMap[w.user_id].avatarUrl) || '',
        park: w.park, ride: w.ride, postedWait: w.posted_wait, actualWait: w.actual_wait,
        ts: new Date(w.created_at).getTime() };
    });
    // donor wall entries: user_id links to a live account (if it still exists and
    // wasn't unlinked) - displayName is a snapshot taken when the donor was added,
    // so the wall still shows a name even if that account is later deleted.
    STATE.donors = (r[6].data || []).map(function (d) {
      var u = d.user_id && idMap[d.user_id];
      return { id: d.id, userId: d.user_id || null,
        displayName: d.display_name,
        username: u ? u.username : null,
        avatar: u ? u.avatar : '', avatarUrl: u ? u.avatarUrl : '',
        ts: new Date(d.created_at).getTime() };
    });
    rerenderActive();
  } catch (e) { console.log('loadData error:', e); }
}

// Park -> restaurant cascading select, same idea as updateRideOptions() in
// supabase-waittimes.js. RESTAURANTS_BY_PARK comes from restaurants-data.js.
function updateRestaurantOptions() {
  var park = document.getElementById('fr-park').value;
  var sel = document.getElementById('fr-spot');
  var list = typeof RESTAURANTS_BY_PARK !== 'undefined' ? RESTAURANTS_BY_PARK[park] : null;
  if (!list) { sel.innerHTML = '<option value="">Select a park first...</option>'; return; }
  var byType = { table: [], quick: [], snack: [] };
  list.forEach(function (item) { if (byType[item[1]]) byType[item[1]].push(item[0]); });
  var html = '<option value="">Select where you ate...</option>';
  ['table', 'quick', 'snack'].forEach(function (t) {
    if (!byType[t].length) return;
    html += '<optgroup label="' + DINING_TYPE_LABELS[t] + '">' +
      byType[t].map(function (n) { return '<option>' + escapeHtml(n) + '</option>'; }).join('') +
      '</optgroup>';
  });
  html += '<option value="__other__">Other / not listed here...</option>';
  sel.innerHTML = html;
}

function handleSpotSelect() {
  foodClearPick();
  var isOther = document.getElementById('fr-spot').value === '__other__';
  var other = document.getElementById('fr-spot-other');
  other.style.display = isOther ? 'block' : 'none';
  if (!isOther) other.value = '';
}

// used when pre-filling the form from a search pick, a "want to try" favorite,
// or editing an existing review - all of which carry a plain spot string that
// may or may not still be one of the curated options for that park (older
// rows especially, or a name that's since changed)
function setSpotValue(spotText) {
  var sel = document.getElementById('fr-spot');
  spotText = spotText || '';
  if (!spotText) { sel.value = ''; handleSpotSelect(); return; }
  sel.value = spotText;
  if (sel.value !== spotText) {
    // not one of the curated options for this park - fall back to Other
    sel.value = '__other__';
    document.getElementById('fr-spot-other').value = spotText;
  }
  handleSpotSelect();
}

function getSpotValue() {
  var sel = document.getElementById('fr-spot');
  if (sel.value === '__other__') return document.getElementById('fr-spot-other').value.trim();
  return sel.value.trim();
}

// distinct food items that already exist (name + park + spot)
function foodItemsList() {
  var seen = {}, out = [];
  STATE.foodReviews.forEach(function (r) {
    var spot = r.spot || '';
    var key = r.itemName.toLowerCase() + '|' + r.park + '|' + spot.toLowerCase();
    if (!seen[key]) { seen[key] = true; out.push({ name: r.itemName, park: r.park, spot: spot }); }
  });
  return out;
}

function foodSearch() {
  var q = document.getElementById('fr-search').value.trim().toLowerCase();
  var box = document.getElementById('fr-results');
  if (q.length < 2) { box.innerHTML = ''; box.style.display = 'none'; return; }
  var matches = foodItemsList().filter(function (i) { return i.name.toLowerCase().indexOf(q) >= 0; }).slice(0, 8);
  var html = matches.map(function (i) {
    var loc = i.park + (i.spot ? ' · ' + i.spot : '');
    return '<div class="fr-result" data-n="' + encodeURIComponent(i.name) + '" data-p="' + encodeURIComponent(i.park) + '" data-s="' + encodeURIComponent(i.spot) + '" onclick="foodPickEl(this)"><span class="fr-r-name">' + escapeHtml(i.name) + '</span><span class="fr-r-loc">' + escapeHtml(loc) + '</span></div>';
  }).join('');
  html += '<div class="fr-result fr-result-new" onclick="foodAddNew()">+ Add as a new item</div>';
  box.innerHTML = html;
  box.style.display = 'block';
}

function foodPickEl(el) {
  var n = decodeURIComponent(el.getAttribute('data-n'));
  var p = decodeURIComponent(el.getAttribute('data-p'));
  var s = decodeURIComponent(el.getAttribute('data-s'));
  document.getElementById('fr-search').value = n;
  document.getElementById('fr-name').value = n;
  document.getElementById('fr-park').value = p;
  updateRestaurantOptions();
  setSpotValue(s);
  document.getElementById('fr-results').style.display = 'none';
  var picked = document.getElementById('fr-picked');
  picked.innerHTML = 'Rating <strong>' + escapeHtml(n) + '</strong> — ' + escapeHtml(p + (s ? ' · ' + s : '')) + ' <a onclick="foodClearPick()">change</a>';
  picked.style.display = 'block';
}

function foodAddNew() {
  document.getElementById('fr-results').style.display = 'none';
  document.getElementById('fr-name').value = document.getElementById('fr-search').value.trim();
  var p = document.getElementById('fr-picked'); if (p) p.style.display = 'none';
}

function foodClearPick() {
  var p = document.getElementById('fr-picked'); if (p) p.style.display = 'none';
}

function resetFoodForm() {
  ['fr-search', 'fr-name', 'fr-review'].forEach(function (id) { var e = document.getElementById(id); if (e) e.value = ''; });
  updateRestaurantOptions();
  var other = document.getElementById('fr-spot-other'); if (other) { other.value = ''; other.style.display = 'none'; }
  var r = document.getElementById('fr-results'); if (r) { r.innerHTML = ''; r.style.display = 'none'; }
  var p = document.getElementById('fr-picked'); if (p) p.style.display = 'none';
  var sc = document.getElementById('fr-score'); if (sc) sc.value = 8.5;
  var sd = document.getElementById('fr-score-display'); if (sd) sd.textContent = '8.5';
  var pv = document.getElementById('fr-photo-preview'); if (pv) pv.style.display = 'none';
  var pf = document.getElementById('fr-photo-file'); if (pf) pf.value = '';
  var pi = document.getElementById('fr-photo-img'); if (pi) pi.removeAttribute('src');
  frEditId = null;
  var _t = document.querySelector('#overlay-food-review .modal-hd-title'); if (_t) _t.textContent = 'Rate a Food Item';
  var _b = document.querySelector('#overlay-food-review .modal-footer .btn-sm.primary'); if (_b) _b.textContent = 'Submit Review';
}

function handleFoodPhoto(e) {
  var file = e.target.files[0]; if (!file) return;
  var reader = new FileReader();
  reader.onload = function (rd) {
    document.getElementById('fr-photo-preview').style.display = 'block';
    document.getElementById('fr-photo-img').src = rd.target.result;
  };
  reader.readAsDataURL(file);
}

async function submitFoodReview() {
  if (!STATE.currentUser) { openOverlay('overlay-register'); return; }
  var name = document.getElementById('fr-name').value.trim();
  var park = document.getElementById('fr-park').value;
  var spot = getSpotValue();
  if (!name) { toast('Pick an item or enter a name.', 'error'); return; }
  var score = parseFloat(document.getElementById('fr-score').value);
  var review = document.getElementById('fr-review').value.trim();

  var photoUrl = null;
  var _fp = document.getElementById('fr-photo-img');
  var _fpSrc = _fp && _fp.getAttribute('src');
  if (_fpSrc && _fpSrc.indexOf('data:') === 0) {
    var _small = await downscale(_fpSrc);
    photoUrl = await uploadPhoto(_small, STATE.currentUser.id);
  } else if (frEditId && _fpSrc) {
    photoUrl = _fpSrc; // unchanged existing photo
  }

  if (frEditId) {
    var _up = await sb.from('food_reviews').update({ item_name: name, park: park, spot: spot, score: score, review: review, photo_url: photoUrl }).eq('id', frEditId).eq('user_id', STATE.currentUser.id);
    if (_up.error) { toast('Could not update: ' + _up.error.message, 'error'); return; }
    closeOverlay('overlay-food-review');
    resetFoodForm();
    await loadData();
    showView('profile');
    toast('Review updated!');
    return;
  }
  var res = await sb.from('food_reviews').insert({ user_id: STATE.currentUser.id, item_name: name, park: park, spot: spot, score: score, review: review, photo_url: photoUrl });
  if (res.error) { toast('Could not save: ' + res.error.message, 'error'); return; }
  if (photoUrl) await sb.from('photos').insert({ user_id: STATE.currentUser.id, park: park, caption: name + (spot ? ' - ' + spot : ''), image_url: photoUrl });
  var matchingFavorite = STATE.foodFavorites.find(function (f) {
    return f.userId === STATE.currentUser.id && f.itemName.toLowerCase() === name.toLowerCase() &&
      f.park === park && (f.spot || '') === spot;
  });
  if (matchingFavorite) await sb.from('food_favorites').delete().eq('id', matchingFavorite.id);
  closeOverlay('overlay-food-review');
  resetFoodForm();
  await loadData();
  showView('food');
  toast(name + ' rated ' + score.toFixed(1) + '/10!');
}

// aggregate reviews per item = name + park + spot (case-insensitive), fixes count
function getFoodAggregates() {
  var map = {};
  STATE.foodReviews.forEach(function (r) {
    var spot = r.spot || '';
    var key = r.itemName.toLowerCase() + '|' + r.park + '|' + spot.toLowerCase();
    if (!map[key]) map[key] = { itemName: r.itemName, park: r.park, spot: spot, scores: [], count: 0 };
    map[key].scores.push(r.score); map[key].count++;
  });
  return Object.keys(map).map(function (k) {
    var m = map[k];
    var avg = m.scores.reduce(function (a, b) { return a + b; }, 0) / m.scores.length;
    return { itemName: m.itemName, park: m.park, spot: m.spot, count: m.count, avgScore: Math.round(avg * 10) / 10 };
  }).sort(function (a, b) { return b.avgScore - a.avgScore; });
}

function renderFood() {
  var agg = getFoodAggregates();
  var byScore = agg.slice().sort(function (a, b) { return b.avgScore - a.avgScore; }).slice(0, 10);
  var byPop = agg.slice().sort(function (a, b) { return b.count - a.count; }).slice(0, 10);
  var renderList = function (items, el) {
    if (!el) return;
    if (!items.length) { el.innerHTML = '<div class="empty-state"><div class="empty-state-sub">No food ratings yet.<br>Be the first to rate an item!</div></div>'; return; }
    el.innerHTML = items.map(function (item, i) {
      var loc = item.park + (item.spot ? ' · ' + item.spot : '');
      return '<div class="food-item" data-n="' + encodeURIComponent(item.itemName) + '" data-p="' + encodeURIComponent(item.park) + '" data-s="' + encodeURIComponent(item.spot) + '" onclick="openFoodDetailEl(this)">' +
        '<div class="food-rank">' + (i + 1) + '</div>' +
        '<div class="food-emoji">' + foodEmoji(item.itemName) + '</div>' +
        '<div class="food-info"><div class="food-name">' + escapeHtml(item.itemName) + '</div><div class="food-loc">' + escapeHtml(loc) + '</div></div>' +
        '<div class="food-score-block"><div class="food-score-num">' + item.avgScore.toFixed(1) + '</div><div class="food-rev-count">' + item.count.toLocaleString() + ' review' + (item.count === 1 ? '' : 's') + '</div></div>' +
        '</div>';
    }).join('');
  };
  renderList(byScore, document.getElementById('food-scores-list'));
  renderList(byPop, document.getElementById('food-popular-list'));
}

function openFoodDetailEl(el) {
  openFoodDetail(decodeURIComponent(el.getAttribute('data-n')), decodeURIComponent(el.getAttribute('data-p')), decodeURIComponent(el.getAttribute('data-s')));
}

var fdCurrent = null;

function openFoodDetail(name, park, spot) {
  var key = name.toLowerCase() + '|' + park + '|' + (spot || '').toLowerCase();
  var reviews = STATE.foodReviews.filter(function (r) {
    var rKey = r.itemName.toLowerCase() + '|' + r.park + '|' + (r.spot || '').toLowerCase();
    return rKey === key;
  }).sort(function (a, b) { return b.ts - a.ts; });
  if (!reviews.length) return;
  var loc = park + (spot ? ' · ' + spot : '');
  var avg = reviews.reduce(function (s, r) { return s + r.score; }, 0) / reviews.length;
  fdCurrent = { name: name, park: park, spot: spot || '' };
  updateFdFavButton();
  document.getElementById('fd-emoji').textContent = foodEmoji(name);
  document.getElementById('fd-title').textContent = name;
  document.getElementById('fd-loc').textContent = loc;
  document.getElementById('fd-avg').textContent = avg.toFixed(1);
  document.getElementById('fd-count').textContent = reviews.length + ' review' + (reviews.length === 1 ? '' : 's');
  document.getElementById('fd-reviews-list').innerHTML = reviews.map(function (r) {
    var mTier = getMonthlyTier(checkinsThisMonth(r.userId));
    var yTier = getYearlyTier(checkinsThisYear(r.userId));
    return '<div class="fd-review">' +
      '<div class="fd-review-hd">' +
        '<span class="fd-review-user user-link" onclick="openUserProfile(\'' + r.userId + '\')">' + avatarHtml(r.avatarUrl, r.avatar, 'avatar-img-inline') + ' ' + escapeHtml(r.username) + ' ' + tierEmblem(mTier, 'Monthly') + ' ' + tierEmblem(yTier, 'Yearly') + '</span>' +
        '<span class="fd-review-score">' + Number(r.score).toFixed(1) + '</span>' +
      '</div>' +
      (r.review ? '<div class="fd-review-text">' + escapeHtml(r.review) + '</div>' : '') +
      (r.photoUrl ? '<img class="fd-review-photo" src="' + r.photoUrl + '" alt="Photo from ' + escapeHtml(r.username) + '\'s review">' : '') +
      '</div>';
  }).join('');
  openOverlay('overlay-food-detail');
}

function isFavorited(name, park, spot) {
  if (!STATE.currentUser) return false;
  return STATE.foodFavorites.some(function (f) {
    return f.userId === STATE.currentUser.id && f.itemName.toLowerCase() === name.toLowerCase() &&
      f.park === park && (f.spot || '') === (spot || '');
  });
}

function updateFdFavButton() {
  var btn = document.getElementById('fd-fav-btn');
  if (!btn || !fdCurrent) return;
  var fav = isFavorited(fdCurrent.name, fdCurrent.park, fdCurrent.spot);
  btn.textContent = fav ? '★ Saved to Want to Try' : '☆ Want to Try';
  btn.className = 'btn-sm' + (fav ? ' primary' : '');
}

async function toggleFavoriteCurrent() {
  if (!STATE.currentUser) { openOverlay('overlay-register'); return; }
  if (!fdCurrent) return;
  var fav = STATE.foodFavorites.find(function (f) {
    return f.userId === STATE.currentUser.id && f.itemName.toLowerCase() === fdCurrent.name.toLowerCase() &&
      f.park === fdCurrent.park && (f.spot || '') === fdCurrent.spot;
  });
  if (fav) {
    var _del = await sb.from('food_favorites').delete().eq('id', fav.id);
    if (_del.error) { toast('Could not remove: ' + _del.error.message, 'error'); return; }
    toast('Removed from your Want to Try list.');
  } else {
    var _ins = await sb.from('food_favorites').insert({ user_id: STATE.currentUser.id, item_name: fdCurrent.name, park: fdCurrent.park, spot: fdCurrent.spot || null });
    if (_ins.error) { toast('Could not save: ' + _ins.error.message, 'error'); return; }
    toast('Added to your Want to Try list!');
  }
  await loadData();
  updateFdFavButton();
}

function renderFoodFavorites() {
  var el = document.getElementById('my-food-favorites');
  if (!el || !STATE.currentUser) return;
  var mine = STATE.foodFavorites.filter(function (f) { return f.userId === STATE.currentUser.id; });
  if (!mine.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-sub">Nothing on your list yet.<br>Save an item from Food Scores to remember it for next time.</div></div>';
    return;
  }
  el.innerHTML = mine.map(function (f) {
    var loc = f.park + (f.spot ? ' · ' + f.spot : '');
    return '<div class="myfr-row">' +
      '<div class="myfr-emoji">' + foodEmoji(f.itemName) + '</div>' +
      '<div class="myfr-info"><div class="myfr-name">' + escapeHtml(f.itemName) + '</div><div class="myfr-loc">' + escapeHtml(loc) + '</div></div>' +
      '<div class="myfr-actions">' +
        '<button class="btn-sm primary" onclick="rateFavorite(\'' + f.id + '\')">Rate It</button>' +
        '<button class="btn-sm danger" onclick="removeFavorite(\'' + f.id + '\')">Remove</button>' +
      '</div>' +
      '</div>';
  }).join('');
}

function rateFavorite(id) {
  var f = STATE.foodFavorites.find(function (x) { return x.id === id; });
  if (!f) return;
  resetFoodForm();
  document.getElementById('fr-search').value = f.itemName;
  document.getElementById('fr-name').value = f.itemName;
  document.getElementById('fr-park').value = f.park;
  updateRestaurantOptions();
  setSpotValue(f.spot || '');
  var picked = document.getElementById('fr-picked');
  picked.innerHTML = 'Rating <strong>' + escapeHtml(f.itemName) + '</strong> — ' + escapeHtml(f.park + (f.spot ? ' · ' + f.spot : '')) + ' <a onclick="foodClearPick()">change</a>';
  picked.style.display = 'block';
  openOverlay('overlay-food-review');
}

async function removeFavorite(id) {
  if (!STATE.currentUser) return;
  if (!confirm('Remove this item from your Want to Try list?')) return;
  var res = await sb.from('food_favorites').delete().eq('id', id).eq('user_id', STATE.currentUser.id);
  if (res.error) { toast('Could not remove: ' + res.error.message, 'error'); return; }
  await loadData();
  showView('profile');
  toast('Removed from your Want to Try list.');
}


function renderMyFoodReviews() {
  var el = document.getElementById('my-food-reviews');
  if (!el || !STATE.currentUser) return;
  var mine = STATE.foodReviews.filter(function (r) { return r.userId === STATE.currentUser.id; });
  if (!mine.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-sub">You have not rated any food yet.<br>Rate an item from the Food Scores page.</div></div>';
    return;
  }
  el.innerHTML = mine.map(function (r) {
    var loc = r.park + (r.spot ? ' · ' + r.spot : '');
    return '<div class="myfr-row">' +
      '<div class="myfr-emoji">' + foodEmoji(r.itemName) + '</div>' +
      '<div class="myfr-info"><div class="myfr-name">' + escapeHtml(r.itemName) + '</div><div class="myfr-loc">' + escapeHtml(loc) + '</div>' + (r.review ? '<div class="myfr-review">' + escapeHtml(r.review) + '</div>' : '') + '</div>' +
      '<div class="myfr-score">' + Number(r.score).toFixed(1) + '</div>' +
      '<div class="myfr-actions">' +
        '<button class="btn-sm" onclick="editFoodReview(\'' + r.id + '\')">Edit</button>' +
        '<button class="btn-sm danger" onclick="deleteFoodReview(\'' + r.id + '\')">Delete</button>' +
      '</div>' +
      '</div>';
  }).join('');
}

async function deleteFoodReview(id) {
  if (!STATE.currentUser) return;
  if (!confirm('Delete this food review? This cannot be undone.')) return;
  var res = await sb.from('food_reviews').delete().eq('id', id).eq('user_id', STATE.currentUser.id);
  if (res.error) { toast('Could not delete: ' + res.error.message, 'error'); return; }
  await loadData();
  showView('profile');
  toast('Review deleted.');
}

function editFoodReview(id) {
  var r = STATE.foodReviews.find(function (x) { return x.id === id; });
  if (!r) return;
  frEditId = id;
  openOverlay('overlay-food-review');
  document.getElementById('fr-search').value = r.itemName;
  document.getElementById('fr-name').value = r.itemName;
  document.getElementById('fr-park').value = r.park;
  updateRestaurantOptions();
  setSpotValue(r.spot || '');
  document.getElementById('fr-score').value = r.score;
  document.getElementById('fr-score-display').textContent = Number(r.score).toFixed(1);
  document.getElementById('fr-review').value = r.review || '';
  var pv = document.getElementById('fr-photo-preview');
  var pi = document.getElementById('fr-photo-img');
  if (r.photoUrl) { pi.src = r.photoUrl; pv.style.display = 'block'; }
  else { pi.removeAttribute('src'); pv.style.display = 'none'; }
  var results = document.getElementById('fr-results'); if (results) results.style.display = 'none';
  var picked = document.getElementById('fr-picked'); if (picked) picked.style.display = 'none';
  var t = document.querySelector('#overlay-food-review .modal-hd-title'); if (t) t.textContent = 'Edit Your Review';
  var b = document.querySelector('#overlay-food-review .modal-footer .btn-sm.primary'); if (b) b.textContent = 'Save Changes';
}

if (typeof renderProfile === 'function') {
  var _origRenderProfile = renderProfile;
  renderProfile = function () { _origRenderProfile(); renderMyFoodReviews(); renderFoodFavorites(); };
}
