/* Turnstiles - EPCOT Festivals: a separate space for festival-specific food
   booth reviews (Food & Wine, Flower & Garden, Festival of the Arts, etc.) so
   seasonal content doesn't clog the year-round Food Scores page.

   "Current" festival = STATE.festivals[0] (the newest row, per loadData()'s
   `order('created_at', {ascending:false})` in supabase-food.js). Everything
   after it is automatically the archive - there's no active/inactive flag
   to keep in sync. Starting a new festival is a one-line manual SQL insert,
   see supabase/schema.sql. Does NOT override loadData() - STATE.festivals /
   STATE.festivalReviews / STATE.festivalFavorites are populated there,
   alongside the other tables (see the note in supabase-food.js's loadData
   about that file owning loadData now). */

var fvEditId = null;
var festTab = 'current';
var festArchiveViewingId = null;
var fvdCurrent = null;

function currentFestival() {
  return (STATE.festivals && STATE.festivals.length) ? STATE.festivals[0] : null;
}

// ============================================================
// FORM
// ============================================================
function handleFestLocationSelect() {
  var isOther = document.getElementById('fv-location').value === '__other__';
  var other = document.getElementById('fv-location-other');
  other.style.display = isOther ? 'block' : 'none';
  if (!isOther) other.value = '';
}

// mirrors setSpotValue()/getSpotValue() in supabase-food.js - falls back to
// "Other" when the stored text isn't one of the curated EPCOT locations
// (an older row, or free text someone typed before this existed)
function setFestLocationValue(locText) {
  var sel = document.getElementById('fv-location');
  locText = locText || '';
  if (!locText) { sel.value = ''; handleFestLocationSelect(); return; }
  sel.value = locText;
  if (sel.value !== locText) {
    sel.value = '__other__';
    document.getElementById('fv-location-other').value = locText;
  }
  handleFestLocationSelect();
}

function getFestLocationValue() {
  var sel = document.getElementById('fv-location');
  if (sel.value === '__other__') return document.getElementById('fv-location-other').value.trim();
  return sel.value.trim();
}

// light autocomplete (native <datalist>) off booth names already used for
// the current festival, so repeat reviews of the same booth tend to match
// up for aggregation without a whole search-and-pick UI like Food Scores has
function populateFestBoothDatalist() {
  var dl = document.getElementById('fv-booth-datalist');
  if (!dl) return;
  var cf = currentFestival();
  if (!cf) { dl.innerHTML = ''; return; }
  var seen = {}, names = [];
  STATE.festivalReviews.forEach(function (r) {
    if (r.festivalId !== cf.id) return;
    var key = r.boothName.toLowerCase();
    if (!seen[key]) { seen[key] = true; names.push(r.boothName); }
  });
  dl.innerHTML = names.map(function (n) { return '<option value="' + escapeHtml(n) + '">'; }).join('');
}

function resetFestivalForm() {
  var b = document.getElementById('fv-booth'); if (b) b.value = '';
  var rv = document.getElementById('fv-review'); if (rv) rv.value = '';
  var loc = document.getElementById('fv-location'); if (loc) loc.value = '';
  var other = document.getElementById('fv-location-other'); if (other) { other.value = ''; other.style.display = 'none'; }
  var sc = document.getElementById('fv-score'); if (sc) sc.value = 8.5;
  var sd = document.getElementById('fv-score-display'); if (sd) sd.textContent = '8.5';
  var pv = document.getElementById('fv-photo-preview'); if (pv) pv.style.display = 'none';
  var pf = document.getElementById('fv-photo-file'); if (pf) pf.value = '';
  var pi = document.getElementById('fv-photo-img'); if (pi) pi.removeAttribute('src');
  fvEditId = null;
  populateFestBoothDatalist();
  var t = document.querySelector('#overlay-festival-review .modal-hd-title'); if (t) t.textContent = 'Rate a Festival Booth';
  var bt = document.querySelector('#overlay-festival-review .modal-footer .btn-sm.primary'); if (bt) bt.textContent = 'Submit Review';
}

function handleFestivalPhoto(e) {
  var file = e.target.files[0]; if (!file) return;
  var reader = new FileReader();
  reader.onload = function (rd) {
    document.getElementById('fv-photo-preview').style.display = 'block';
    document.getElementById('fv-photo-img').src = rd.target.result;
  };
  reader.readAsDataURL(file);
}

async function submitFestivalReview(btn) {
  if (!STATE.currentUser) { openOverlay('overlay-register'); return; }
  // same rapid-double-click guard as submitCheckin/submitFoodReview/etc.
  if (btn && btn.disabled) return;
  if (btn) btn.disabled = true;
  try {
    var cf = currentFestival();
    if (!cf) { toast('No festival is currently active.', 'error'); return; }
    var booth = document.getElementById('fv-booth').value.trim();
    if (!booth) { toast('Enter the booth name.', 'error'); return; }
    var location = getFestLocationValue();
    var score = parseFloat(document.getElementById('fv-score').value);
    var review = document.getElementById('fv-review').value.trim();

    var photoUrl = null;
    var _fp = document.getElementById('fv-photo-img');
    var _fpSrc = _fp && _fp.getAttribute('src');
    if (_fpSrc && _fpSrc.indexOf('data:') === 0) {
      var _small = await downscale(_fpSrc);
      photoUrl = await uploadPhoto(_small, STATE.currentUser.id);
    } else if (fvEditId && _fpSrc) {
      photoUrl = _fpSrc; // unchanged existing photo
    }

    if (fvEditId) {
      var _up = await sb.from('festival_reviews').update({ booth_name: booth, location: location, score: score, review: review, photo_url: photoUrl }).eq('id', fvEditId).eq('user_id', STATE.currentUser.id);
      if (_up.error) { toast('Could not update: ' + _up.error.message, 'error'); return; }
      closeOverlay('overlay-festival-review');
      resetFestivalForm();
      await loadData();
      showView('festivals');
      toast('Review updated!');
      return;
    }
    var res = await sb.from('festival_reviews').insert({ user_id: STATE.currentUser.id, festival_id: cf.id, booth_name: booth, location: location, score: score, review: review, photo_url: photoUrl });
    if (res.error) { toast('Could not save: ' + res.error.message, 'error'); return; }
    if (photoUrl) await sb.from('photos').insert({ user_id: STATE.currentUser.id, park: 'EPCOT', caption: booth + (location ? ' - ' + location : ''), image_url: photoUrl });
    var matchingFavorite = STATE.festivalFavorites.find(function (f) {
      return f.userId === STATE.currentUser.id && f.festivalId === cf.id &&
        f.boothName.toLowerCase() === booth.toLowerCase() && (f.location || '') === location;
    });
    if (matchingFavorite) await sb.from('festival_favorites').delete().eq('id', matchingFavorite.id);
    closeOverlay('overlay-festival-review');
    resetFestivalForm();
    await loadData();
    showView('festivals');
    toast(booth + ' rated ' + score.toFixed(1) + '/10!');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ============================================================
// RANKINGS (shared renderer - used for both the current festival and
// whichever archived festival is being viewed)
// ============================================================
function getFestivalAggregates(festivalId) {
  var map = {};
  STATE.festivalReviews.forEach(function (r) {
    if (r.festivalId !== festivalId) return;
    var loc = r.location || '';
    var key = r.boothName.toLowerCase() + '|' + loc.toLowerCase();
    if (!map[key]) map[key] = { boothName: r.boothName, location: loc, festivalId: festivalId, scores: [], count: 0 };
    map[key].scores.push(r.score); map[key].count++;
  });
  return Object.keys(map).map(function (k) {
    var m = map[k];
    var avg = m.scores.reduce(function (a, b) { return a + b; }, 0) / m.scores.length;
    return { boothName: m.boothName, location: m.location, festivalId: m.festivalId, count: m.count, avgScore: Math.round(avg * 10) / 10 };
  }).sort(function (a, b) { return b.avgScore - a.avgScore; });
}

function renderFestivalLists(agg, scoresElId, popularElId) {
  var byScore = agg.slice().sort(function (a, b) { return b.avgScore - a.avgScore; }).slice(0, 10);
  var byPop = agg.slice().sort(function (a, b) { return b.count - a.count; }).slice(0, 10);
  var renderList = function (items, el) {
    if (!el) return;
    if (!items.length) { el.innerHTML = '<div class="empty-state"><div class="empty-state-sub">No booth ratings yet.<br>Be the first to rate one!</div></div>'; return; }
    el.innerHTML = items.map(function (item, i) {
      var loc = item.location || 'EPCOT';
      return '<div class="food-item" data-n="' + encodeURIComponent(item.boothName) + '" data-l="' + encodeURIComponent(item.location) + '" data-f="' + encodeURIComponent(item.festivalId) + '" onclick="openFestivalDetailEl(this)">' +
        '<div class="food-rank">' + (i + 1) + '</div>' +
        '<div class="food-emoji">' + foodEmoji(item.boothName) + '</div>' +
        '<div class="food-info"><div class="food-name">' + escapeHtml(item.boothName) + '</div><div class="food-loc">' + escapeHtml(loc) + '</div></div>' +
        '<div class="food-score-block"><div class="food-score-num">' + item.avgScore.toFixed(1) + '</div><div class="food-rev-count">' + item.count.toLocaleString() + ' review' + (item.count === 1 ? '' : 's') + '</div></div>' +
        '</div>';
    }).join('');
  };
  renderList(byScore, document.getElementById(scoresElId));
  renderList(byPop, document.getElementById(popularElId));
}

function renderFestivalCurrentLists() {
  var cf = currentFestival();
  var agg = cf ? getFestivalAggregates(cf.id) : [];
  renderFestivalLists(agg, 'fest-scores-list', 'fest-popular-list');
}

// ============================================================
// PAGE / TABS
// ============================================================
function renderFestivalView() {
  var cf = currentFestival();
  var nameEl = document.getElementById('fest-current-name');
  var rateBtn = document.getElementById('fest-rate-btn');
  if (nameEl) nameEl.textContent = cf ? ('\u{1F3AA} ' + cf.name) : '\u{1F3AA} No festival is currently active';
  if (rateBtn) rateBtn.style.display = cf ? '' : 'none';
  renderFestivalCurrentLists();
  var mineWrap = document.getElementById('fest-mine-wrap');
  if (mineWrap) {
    if (STATE.currentUser) { mineWrap.style.display = 'block'; renderFestivalFavorites(); renderMyFestivalReviews(); }
    else mineWrap.style.display = 'none';
  }
  if (festTab === 'archive') renderFestivalArchiveTab();
}

function switchFestivalTab(btn, tab) {
  festTab = tab;
  document.querySelectorAll('#view-festivals .page-tab').forEach(function (b) { b.classList.remove('active'); });
  btn.classList.add('active');
  document.getElementById('fttab-current').style.display = tab === 'current' ? 'block' : 'none';
  document.getElementById('fttab-archive').style.display = tab === 'archive' ? 'block' : 'none';
  if (tab === 'archive') renderFestivalArchiveTab();
}

function renderFestivalArchiveTab() {
  if (festArchiveViewingId) renderFestivalArchiveDetail(festArchiveViewingId);
  else renderFestivalArchiveList();
}

function renderFestivalArchiveList() {
  document.getElementById('fest-archive-back').style.display = 'none';
  document.getElementById('fest-archive-list-wrap').style.display = 'block';
  document.getElementById('fest-archive-detail-wrap').style.display = 'none';
  var el = document.getElementById('fest-archive-list');
  var archived = STATE.festivals.slice(1); // [0] is current; everything after is archive
  if (!archived.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-sub">No past festivals yet.</div></div>';
    return;
  }
  el.innerHTML = archived.map(function (f) {
    var count = STATE.festivalReviews.filter(function (r) { return r.festivalId === f.id; }).length;
    return '<div class="myfr-row" style="cursor:pointer" onclick="openFestivalArchive(\'' + f.id + '\')">' +
      '<div class="myfr-emoji">\u{1F3AA}</div>' +
      '<div class="myfr-info"><div class="myfr-name">' + escapeHtml(f.name) + '</div><div class="myfr-loc">' + count + ' review' + (count === 1 ? '' : 's') + '</div></div>' +
      '<div class="myfr-actions"><button class="btn-sm">View</button></div>' +
      '</div>';
  }).join('');
}

function openFestivalArchive(id) {
  festArchiveViewingId = id;
  renderFestivalArchiveDetail(id);
}

function renderFestivalArchiveDetail(id) {
  var f = STATE.festivals.find(function (x) { return x.id === id; });
  if (!f) { closeFestivalArchiveDetail(); return; }
  document.getElementById('fest-archive-back').style.display = 'block';
  document.getElementById('fest-archive-list-wrap').style.display = 'none';
  document.getElementById('fest-archive-detail-wrap').style.display = 'block';
  document.getElementById('fest-archive-detail-name').textContent = '\u{1F3AA} ' + f.name;
  renderFestivalLists(getFestivalAggregates(id), 'fest-archive-scores-list', 'fest-archive-popular-list');
}

function closeFestivalArchiveDetail() {
  festArchiveViewingId = null;
  renderFestivalArchiveList();
}

// ============================================================
// BOOTH DETAIL MODAL (every individual review for one booth)
// ============================================================
function openFestivalDetailEl(el) {
  openFestivalDetail(decodeURIComponent(el.getAttribute('data-n')), decodeURIComponent(el.getAttribute('data-l')), decodeURIComponent(el.getAttribute('data-f')));
}

function openFestivalDetail(boothName, location, festivalId) {
  var key = boothName.toLowerCase() + '|' + (location || '').toLowerCase();
  var reviews = STATE.festivalReviews.filter(function (r) {
    if (r.festivalId !== festivalId) return false;
    var rKey = r.boothName.toLowerCase() + '|' + (r.location || '').toLowerCase();
    return rKey === key;
  }).sort(function (a, b) { return b.ts - a.ts; });
  if (!reviews.length) return;
  var loc = location || 'EPCOT';
  var avg = reviews.reduce(function (s, r) { return s + r.score; }, 0) / reviews.length;
  var cf = currentFestival();
  fvdCurrent = { boothName: boothName, location: location || '', festivalId: festivalId, isCurrent: !!(cf && cf.id === festivalId) };
  // "Want to Try" only makes sense for the festival that's actually happening
  var favBtn = document.getElementById('fvd-fav-btn');
  if (favBtn) favBtn.style.display = fvdCurrent.isCurrent ? '' : 'none';
  updateFestDetailFavButton();
  document.getElementById('fvd-emoji').textContent = foodEmoji(boothName);
  document.getElementById('fvd-title').textContent = boothName;
  document.getElementById('fvd-loc').textContent = loc;
  document.getElementById('fvd-avg').textContent = avg.toFixed(1);
  document.getElementById('fvd-count').textContent = reviews.length + ' review' + (reviews.length === 1 ? '' : 's');
  document.getElementById('fvd-reviews-list').innerHTML = reviews.map(function (r) {
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
  openOverlay('overlay-festival-detail');
}

// ============================================================
// WANT TO TRY (scoped to the current festival only)
// ============================================================
function isFestivalFavorited(boothName, location, festivalId) {
  if (!STATE.currentUser) return false;
  return STATE.festivalFavorites.some(function (f) {
    return f.userId === STATE.currentUser.id && f.festivalId === festivalId &&
      f.boothName.toLowerCase() === boothName.toLowerCase() && (f.location || '') === (location || '');
  });
}

function updateFestDetailFavButton() {
  var btn = document.getElementById('fvd-fav-btn');
  if (!btn || !fvdCurrent) return;
  var fav = isFestivalFavorited(fvdCurrent.boothName, fvdCurrent.location, fvdCurrent.festivalId);
  btn.textContent = fav ? '★ Saved to Want to Try' : '☆ Want to Try';
  btn.className = 'btn-sm' + (fav ? ' primary' : '');
}

async function toggleFestivalFavoriteCurrent() {
  if (!STATE.currentUser) { openOverlay('overlay-register'); return; }
  if (!fvdCurrent) return;
  var fav = STATE.festivalFavorites.find(function (f) {
    return f.userId === STATE.currentUser.id && f.festivalId === fvdCurrent.festivalId &&
      f.boothName.toLowerCase() === fvdCurrent.boothName.toLowerCase() && (f.location || '') === fvdCurrent.location;
  });
  if (fav) {
    var _del = await sb.from('festival_favorites').delete().eq('id', fav.id);
    if (_del.error) { toast('Could not remove: ' + _del.error.message, 'error'); return; }
    toast('Removed from your Want to Try list.');
  } else {
    var _ins = await sb.from('festival_favorites').insert({ user_id: STATE.currentUser.id, festival_id: fvdCurrent.festivalId, booth_name: fvdCurrent.boothName, location: fvdCurrent.location || null });
    if (_ins.error) { toast('Could not save: ' + _ins.error.message, 'error'); return; }
    toast('Added to your Want to Try list!');
  }
  await loadData();
  updateFestDetailFavButton();
}

function renderFestivalFavorites() {
  var el = document.getElementById('fest-my-favorites');
  if (!el || !STATE.currentUser) return;
  var cf = currentFestival();
  var mine = cf ? STATE.festivalFavorites.filter(function (f) { return f.userId === STATE.currentUser.id && f.festivalId === cf.id; }) : [];
  if (!mine.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-sub">Nothing on your list yet.<br>Save a booth from above to remember it for next time.</div></div>';
    return;
  }
  el.innerHTML = mine.map(function (f) {
    var loc = f.location || 'EPCOT';
    return '<div class="myfr-row">' +
      '<div class="myfr-emoji">' + foodEmoji(f.boothName) + '</div>' +
      '<div class="myfr-info"><div class="myfr-name">' + escapeHtml(f.boothName) + '</div><div class="myfr-loc">' + escapeHtml(loc) + '</div></div>' +
      '<div class="myfr-actions">' +
        '<button class="btn-sm primary" onclick="rateFestivalFavorite(\'' + f.id + '\')">Rate It</button>' +
        '<button class="btn-sm danger" onclick="removeFestivalFavorite(\'' + f.id + '\')">Remove</button>' +
      '</div>' +
      '</div>';
  }).join('');
}

function rateFestivalFavorite(id) {
  var f = STATE.festivalFavorites.find(function (x) { return x.id === id; });
  if (!f) return;
  resetFestivalForm();
  document.getElementById('fv-booth').value = f.boothName;
  setFestLocationValue(f.location || '');
  openOverlay('overlay-festival-review');
}

async function removeFestivalFavorite(id) {
  if (!STATE.currentUser) return;
  if (!confirm('Remove this booth from your Want to Try list?')) return;
  var res = await sb.from('festival_favorites').delete().eq('id', id).eq('user_id', STATE.currentUser.id);
  if (res.error) { toast('Could not remove: ' + res.error.message, 'error'); return; }
  await loadData();
  showView('festivals');
  toast('Removed from your Want to Try list.');
}

// ============================================================
// MY BOOTH REVIEWS
// ============================================================
function renderMyFestivalReviews() {
  var el = document.getElementById('fest-my-reviews');
  if (!el || !STATE.currentUser) return;
  var cf = currentFestival();
  var mine = cf ? STATE.festivalReviews.filter(function (r) { return r.userId === STATE.currentUser.id && r.festivalId === cf.id; }) : [];
  if (!mine.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-sub">You have not rated any booths yet.<br>Rate one above to get started.</div></div>';
    return;
  }
  el.innerHTML = mine.map(function (r) {
    var loc = r.location || 'EPCOT';
    return '<div class="myfr-row">' +
      '<div class="myfr-emoji">' + foodEmoji(r.boothName) + '</div>' +
      '<div class="myfr-info"><div class="myfr-name">' + escapeHtml(r.boothName) + '</div><div class="myfr-loc">' + escapeHtml(loc) + '</div>' + (r.review ? '<div class="myfr-review">' + escapeHtml(r.review) + '</div>' : '') + '</div>' +
      '<div class="myfr-score">' + Number(r.score).toFixed(1) + '</div>' +
      '<div class="myfr-actions">' +
        '<button class="btn-sm" onclick="editFestivalReview(\'' + r.id + '\')">Edit</button>' +
        '<button class="btn-sm danger" onclick="deleteFestivalReview(\'' + r.id + '\')">Delete</button>' +
      '</div>' +
      '</div>';
  }).join('');
}

async function deleteFestivalReview(id) {
  if (!STATE.currentUser) return;
  if (!confirm('Delete this festival review? This cannot be undone.')) return;
  var res = await sb.from('festival_reviews').delete().eq('id', id).eq('user_id', STATE.currentUser.id);
  if (res.error) { toast('Could not delete: ' + res.error.message, 'error'); return; }
  await loadData();
  showView('festivals');
  toast('Review deleted.');
}

function editFestivalReview(id) {
  var r = STATE.festivalReviews.find(function (x) { return x.id === id; });
  if (!r) return;
  fvEditId = id;
  openOverlay('overlay-festival-review');
  populateFestBoothDatalist();
  document.getElementById('fv-booth').value = r.boothName;
  setFestLocationValue(r.location || '');
  document.getElementById('fv-score').value = r.score;
  document.getElementById('fv-score-display').textContent = Number(r.score).toFixed(1);
  document.getElementById('fv-review').value = r.review || '';
  var pv = document.getElementById('fv-photo-preview');
  var pi = document.getElementById('fv-photo-img');
  if (r.photoUrl) { pi.src = r.photoUrl; pv.style.display = 'block'; }
  else { pi.removeAttribute('src'); pv.style.display = 'none'; }
  var t = document.querySelector('#overlay-festival-review .modal-hd-title'); if (t) t.textContent = 'Edit Your Review';
  var b = document.querySelector('#overlay-festival-review .modal-footer .btn-sm.primary'); if (b) b.textContent = 'Save Changes';
}
