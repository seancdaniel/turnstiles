/* Turnstiles - food items: search-and-pick + spot, de-duplicated ratings */

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

// full data load (overrides supabase-data.js loadData; adds `spot` to reviews)
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
        itemName: f.item_name, park: f.park, spot: f.spot || '', score: Number(f.score),
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
  document.getElementById('fr-spot').value = s;
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
  ['fr-search', 'fr-name', 'fr-spot', 'fr-review'].forEach(function (id) { var e = document.getElementById(id); if (e) e.value = ''; });
  var r = document.getElementById('fr-results'); if (r) { r.innerHTML = ''; r.style.display = 'none'; }
  var p = document.getElementById('fr-picked'); if (p) p.style.display = 'none';
  var sc = document.getElementById('fr-score'); if (sc) sc.value = 8.5;
  var sd = document.getElementById('fr-score-display'); if (sd) sd.textContent = '8.5';
}

async function submitFoodReview() {
  if (!STATE.currentUser) { openOverlay('overlay-register'); return; }
  var name = document.getElementById('fr-name').value.trim();
  var park = document.getElementById('fr-park').value;
  var spot = document.getElementById('fr-spot').value.trim();
  if (!name) { toast('Pick an item or enter a name.', 'error'); return; }
  var score = parseFloat(document.getElementById('fr-score').value);
  var review = document.getElementById('fr-review').value.trim();
  var res = await sb.from('food_reviews').insert({ user_id: STATE.currentUser.id, item_name: name, park: park, spot: spot, score: score, review: review });
  if (res.error) { toast('Could not save: ' + res.error.message, 'error'); return; }
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
      return '<div class="food-item">' +
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
