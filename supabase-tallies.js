/* Turnstiles - Rides and Food leaderboards, plus the tap-to-log that feeds them.
 *
 * Both boards count tallies, not reviews. A review is a one-time opinion about a
 * specific item at a specific place; a tally is "I did this again". They are
 * different questions, so they get different tables (`ride_logs`,
 * `food_tallies`) rather than being derived from `food_reviews`, which has no
 * repeats in it at all.
 *
 * THE GATE: you can only log while checked in at a park today. That is enforced
 * in the RLS policies (see supabase/leaderboard-sections.sql), not just by the
 * disabled button here. A client-side check alone would be decoration, since
 * anyone can POST straight at the REST API, and a leaderboard of numbers anyone
 * can type is not a leaderboard.
 */

// ============================================================
// FOOD CATEGORIES
// ============================================================
/* Curated and generic on purpose. Per-restaurant counts would fragment into
   hundreds of near-empty boards; "who has eaten the most churros" is one good
   board. Same pattern as RIDES_BY_PARK: a plain hardcoded list, extend it when
   somebody asks for one. `key` is what lands in the database, so renaming a
   label is safe but changing a key orphans every row that used it. */
var FOOD_CATEGORIES = [
  { key: 'hot_dog',     label: 'Hot Dogs',     emoji: '\u{1F32D}' },
  { key: 'churro',      label: 'Churros',      emoji: '\u{1F956}' },
  { key: 'dole_whip',   label: 'Dole Whips',   emoji: '\u{1F34D}' },
  { key: 'pretzel',     label: 'Pretzels',     emoji: '\u{1F968}' },
  { key: 'popcorn',     label: 'Popcorn',      emoji: '\u{1F37F}' },
  { key: 'turkey_leg',  label: 'Turkey Legs',  emoji: '\u{1F357}' },
  { key: 'pizza',       label: 'Pizza Slices', emoji: '\u{1F355}' },
  { key: 'ice_cream',   label: 'Ice Cream',    emoji: '\u{1F366}' },
  { key: 'funnel_cake', label: 'Funnel Cakes', emoji: '\u{1F9C7}' },
  { key: 'butterbeer',  label: 'Butterbeer',   emoji: '\u{1F37A}' },
  { key: 'beignet',     label: 'Beignets',     emoji: '\u{1F369}' },
  { key: 'margarita',   label: 'Margaritas',   emoji: '\u{1F379}' }
];

function foodCat(key) {
  for (var i = 0; i < FOOD_CATEGORIES.length; i++) {
    if (FOOD_CATEGORIES[i].key === key) return FOOD_CATEGORIES[i];
  }
  return null;
}

// ============================================================
// THE CHECK-IN GATE
// ============================================================
/* The app's local calendar day. The database uses America/New_York for the same
   purpose (public.park_today), because a 9pm Florida ride is already tomorrow in
   UTC. For a user actually in the parks these agree; for anyone browsing from
   another timezone the database is the authority and the button is a courtesy. */
function parkTodayStr() {
  var d = new Date();
  var s = d.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
  return s; // YYYY-MM-DD
}

// today's check-ins for the signed-in user, newest first
function activeCheckins() {
  if (!STATE.currentUser) return [];
  var today = parkTodayStr();
  return (STATE.checkins || []).filter(function (c) {
    return c.userId === STATE.currentUser.id && c.date === today;
  });
}

function activeParks() {
  var seen = {}, out = [];
  activeCheckins().forEach(function (c) { if (!seen[c.park]) { seen[c.park] = 1; out.push(c.park); } });
  return out;
}

function isCheckedInAt(park) { return activeParks().indexOf(park) >= 0; }

// ============================================================
// RIDE LEADERBOARD
// ============================================================
var rideSel = '';          // selected ride name
var rideLogPark = '';      // park chosen in the log panel
var lbRidePark = 'all';    // park filter on the overall board

function rideCounts() {
  var byRide = {}, byUser = {};
  (STATE.rideLogs || []).forEach(function (r) {
    if (!byRide[r.ride]) byRide[r.ride] = { ride: r.ride, park: r.park, total: 0, users: {} };
    byRide[r.ride].total++;
    byRide[r.ride].users[r.userId] = (byRide[r.ride].users[r.userId] || 0) + 1;

    if (!byUser[r.userId]) byUser[r.userId] = { total: 0, rides: {}, park: {} };
    byUser[r.userId].total++;
    byUser[r.userId].rides[r.ride] = true;
    byUser[r.userId].park[r.park] = (byUser[r.userId].park[r.park] || 0) + 1;
  });
  return { byRide: byRide, byUser: byUser };
}

function userRow(userId) {
  var u = (STATE.users || []).find(function (x) { return x.id === userId; });
  return u || { id: userId, username: 'someone', avatar: '\u{1F3A2}', avatarUrl: '' };
}

/* The picker is built from rides people have actually logged, not from the full
   ~200-attraction roster. A dropdown of two hundred rides where all but six are
   empty is worse than useless, and the popular ones are what anyone wants. */
function buildRidePicker() {
  var sel = document.getElementById('rl-ride');
  if (!sel) return;
  var counts = rideCounts().byRide;
  var rides = Object.keys(counts).map(function (k) { return counts[k]; })
    .sort(function (a, b) { return b.total - a.total || a.ride.localeCompare(b.ride); });

  if (!rides.length) { sel.innerHTML = '<option value="">Nothing logged yet</option>'; rideSel = ''; return; }
  if (!rideSel || !counts[rideSel]) rideSel = rides[0].ride;

  sel.innerHTML = rides.map(function (r) {
    return '<option value="' + escapeHtml(r.ride) + '"' + (r.ride === rideSel ? ' selected' : '') + '>' +
      escapeHtml(r.ride) + ' · ' + escapeHtml(r.park) + '</option>';
  }).join('');
}

function setRideSel(v) { rideSel = v; renderRideBoards(); }
function setLbRidePark(v) { lbRidePark = v; renderRideBoards(); }

function tallyRowHtml(userId, rank, count, sub, unit) {
  var u = userRow(userId);
  var me = STATE.currentUser && userId === STATE.currentUser.id;
  var medal = rank === 1 ? ' g1' : rank === 2 ? ' g2' : rank === 3 ? ' g3' : '';
  return '<div class="lb2-row tly-row' + (me ? ' you' : '') + '" tabindex="0" role="button"' +
      ' onclick="openUserProfile(\'' + u.id + '\')"' +
      ' onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();openUserProfile(\'' + u.id + '\');}">' +
    '<div class="lb2-rank' + medal + '">' + rank + '</div>' +
    '<div class="lb2-av">' + avatarHtml(u.avatarUrl, u.avatar) + '</div>' +
    '<div class="tly-name">' + escapeHtml(u.username) +
      (me ? '<span class="lb2-you" style="margin-left:8px">You</span>' : '') +
      '<small>' + sub + '</small></div>' +
    '<div class="tly-count">' + count + '<span>' + unit + '</span></div>' +
  '</div>';
}

/* Turn a Supabase error into something worth reading.
   The gate is enforced in RLS, so a refusal is almost always "you are not
   checked in" rather than a fault. The missing-table case matters too: Vercel
   deploys the moment this is pushed but the SQL is run by hand afterwards, and
   in that window a raw schema-cache error tells nobody anything. */
function tallyError(err, gateMsg) {
  var m = (err && err.message) || '';
  if (/row-level security/i.test(m)) return gateMsg;
  if (/schema cache|does not exist|Could not find the table/i.test(m)) {
    return 'Ride and food tallies are not set up yet. Try again later.';
  }
  return 'Could not log that: ' + m;
}

function emptyBoardHtml(title, sub) {
  return '<div class="lb2-empty"><div class="lb2-empty-t">' + title + '</div>' +
    '<div class="lb2-empty-s">' + sub + '</div></div>';
}

function renderRideBoards() {
  // the picker resolves which ride is selected, so it has to run BEFORE the
  // boards read rideSel - otherwise the first render finds an empty selection
  // and shows "no attraction yet" on a board that has data
  buildRidePicker();
  var c = rideCounts();

  // ---- one attraction ----
  var oneEl = document.getElementById('rl-list-one');
  var oneHd = document.getElementById('rl-title-one');
  var oneSub = document.getElementById('rl-sub-one');
  if (oneEl) {
    var entry = c.byRide[rideSel];
    if (oneHd) oneHd.textContent = entry ? entry.ride : 'No attraction yet';
    if (oneSub) oneSub.textContent = entry ? (entry.park + ' · all time') : 'Nothing logged yet';
    if (!entry) {
      oneEl.innerHTML = emptyBoardHtml('Nothing Logged Yet',
        'Check in at a park and log your first lap to start this board.');
    } else {
      var rows = Object.keys(entry.users).map(function (uid) { return { uid: uid, n: entry.users[uid] }; })
        .sort(function (a, b) { return b.n - a.n; });
      oneEl.innerHTML = rows.map(function (r, i) {
        var mine = c.byUser[r.uid];
        var breadth = mine ? Object.keys(mine.rides).length : 0;
        return tallyRowHtml(r.uid, i + 1, r.n, breadth + ' attraction' + (breadth === 1 ? '' : 's') + ' logged', 'rides');
      }).join('');
    }
  }

  // ---- most rides overall ----
  var allEl = document.getElementById('rl-list-all');
  if (allEl) {
    var parks = null;
    if (lbRidePark === 'disney' || lbRidePark === 'universal') parks = LB_GROUPS[lbRidePark].parks;
    var totals = {};
    (STATE.rideLogs || []).forEach(function (r) {
      if (parks && parks.indexOf(r.park) < 0) return;
      if (!totals[r.userId]) totals[r.userId] = { n: 0, rides: {} };
      totals[r.userId].n++;
      totals[r.userId].rides[r.ride] = true;
    });
    var list = Object.keys(totals).map(function (uid) { return { uid: uid, n: totals[uid].n, b: Object.keys(totals[uid].rides).length }; })
      .sort(function (a, b) { return b.n - a.n; });
    allEl.innerHTML = list.length
      ? list.map(function (r, i) {
          return tallyRowHtml(r.uid, i + 1, r.n, r.b + ' different attraction' + (r.b === 1 ? '' : 's'), 'rides');
        }).join('')
      : emptyBoardHtml('Nobody Yet', 'No rides logged here so far.');
  }

  renderRideLogPanel();
}

// ---- the log panel ----
function renderRideLogPanel() {
  var el = document.getElementById('rl-log');
  if (!el) return;

  if (!STATE.currentUser) {
    el.className = 'tly-log';
    el.innerHTML = '<div><div class="tly-log-t">Log your own laps</div>' +
      '<div class="tly-log-s">Create a free account, check in at a park, and every ride you log lands on this board.</div></div>' +
      '<div class="tly-log-btns"><button class="tly-tap" onclick="openOverlay(\'overlay-register\')">Create Account</button></div>';
    return;
  }

  var parks = activeParks();
  if (!parks.length) {
    el.className = 'tly-log';
    el.innerHTML = '<div><div class="tly-log-t">Not at a park right now</div>' +
      '<div class="tly-log-s">Rides can only be logged while you are checked in at that park today. ' +
      'That is what keeps this board honest.</div></div>' +
      '<div class="tly-log-btns"><button class="tly-tap" onclick="newCheckin()">Check In</button></div>';
    return;
  }

  if (!rideLogPark || parks.indexOf(rideLogPark) < 0) rideLogPark = parks[0];
  var rides = (typeof RIDES_BY_PARK === 'object' && RIDES_BY_PARK[rideLogPark]) || [];

  el.className = 'tly-log live';
  el.innerHTML =
    '<div class="tly-log-main">' +
      '<div class="tly-here"><i></i> Checked in at ' + escapeHtml(rideLogPark) + '</div>' +
      '<div class="tly-log-t">Log a lap</div>' +
      (parks.length > 1
        ? '<select class="tly-parkpick" aria-label="Which park" onchange="rideLogPark=this.value;renderRideLogPanel()">' +
            parks.map(function (p) {
              return '<option' + (p === rideLogPark ? ' selected' : '') + '>' + escapeHtml(p) + '</option>';
            }).join('') + '</select>'
        : '') +
      '<select class="tly-ridepick" id="rl-log-ride" aria-label="Which attraction">' +
        rides.map(function (r) { return '<option>' + escapeHtml(r) + '</option>'; }).join('') +
      '</select>' +
    '</div>' +
    '<div class="tly-log-btns">' +
      '<button class="tly-tap" onclick="logRide(this,1)">&#43; Rode It</button>' +
      '<button class="tly-tap ghost" onclick="logRide(this,3)">Rode it 3&times;</button>' +
    '</div>';
}

async function logRide(btn, times) {
  if (!STATE.currentUser) { openOverlay('overlay-register'); return; }
  if (btn && btn.disabled) return;              // same double-click guard as submitCheckin
  var sel = document.getElementById('rl-log-ride');
  var ride = sel ? sel.value : '';
  if (!ride) { toast('Pick an attraction first.', 'error'); return; }
  if (btn) btn.disabled = true;
  try {
    var rows = [];
    for (var i = 0; i < times; i++) rows.push({ user_id: STATE.currentUser.id, ride: ride, park: rideLogPark });
    var res = await sb.from('ride_logs').insert(rows);
    if (res.error) {
      // the RLS gate is the real check, so a refusal here is usually "you are
      // not checked in" rather than a bug worth showing raw
      toast(tallyError(res.error,
        'You need an active check-in at ' + rideLogPark + ' to log a ride there.'), 'error');
      return;
    }
    await loadData();
    showView('rides');
    toast(times > 1 ? (times + ' laps on ' + ride + ' logged!') : (ride + ' logged!'));
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ============================================================
// FOOD LEADERBOARD
// ============================================================
var foodSel = FOOD_CATEGORIES[0].key;

function foodCounts() {
  var byKey = {}, byUser = {};
  (STATE.foodTallies || []).forEach(function (t) {
    if (!byKey[t.foodKey]) byKey[t.foodKey] = { total: 0, users: {} };
    byKey[t.foodKey].total++;
    byKey[t.foodKey].users[t.userId] = (byKey[t.foodKey].users[t.userId] || 0) + 1;

    if (!byUser[t.userId]) byUser[t.userId] = { total: 0, keys: {} };
    byUser[t.userId].total++;
    byUser[t.userId].keys[t.foodKey] = (byUser[t.userId].keys[t.foodKey] || 0) + 1;
  });
  return { byKey: byKey, byUser: byUser };
}

function setFoodSel(key) { foodSel = key; renderFoodBoards(); }

function renderFoodBoards() {
  var c = foodCounts();
  var me = STATE.currentUser;

  // ---- the tile grid, which is also the picker ----
  var grid = document.getElementById('fl-tiles');
  if (grid) {
    grid.innerHTML = FOOD_CATEGORIES.map(function (f) {
      var mine = me && c.byUser[me.id] ? (c.byUser[me.id].keys[f.key] || 0) : 0;
      var total = c.byKey[f.key] ? c.byKey[f.key].total : 0;
      return '<button type="button" class="fdx-tile' + (f.key === foodSel ? ' on' : '') + '"' +
          ' onclick="setFoodSel(\'' + f.key + '\')" aria-pressed="' + (f.key === foodSel) + '">' +
        '<span class="fdx-emoji">' + f.emoji + '</span>' +
        '<span class="fdx-name">' + escapeHtml(f.label) + '</span>' +
        '<span class="fdx-mine">' + (me ? 'You: ' + mine : total + ' logged') + '</span>' +
      '</button>';
    }).join('');
  }

  // ---- one category ----
  var cat = foodCat(foodSel);
  var oneEl = document.getElementById('fl-list-one');
  var oneHd = document.getElementById('fl-title-one');
  if (oneHd && cat) oneHd.innerHTML = cat.emoji + ' ' + escapeHtml(cat.label);
  if (oneEl) {
    var entry = c.byKey[foodSel];
    var rows = entry
      ? Object.keys(entry.users).map(function (uid) { return { uid: uid, n: entry.users[uid] }; })
          .sort(function (a, b) { return b.n - a.n; })
      : [];
    oneEl.innerHTML = rows.length
      ? rows.map(function (r, i) {
          var mine = c.byUser[r.uid];
          var breadth = mine ? Object.keys(mine.keys).length : 0;
          return tallyRowHtml(r.uid, i + 1, r.n, breadth + ' of 12 categories', 'eaten');
        }).join('')
      : emptyBoardHtml('Nobody Yet', 'No ' + (cat ? cat.label.toLowerCase() : 'items') + ' logged so far. Be the first.');
  }

  // ---- biggest appetite ----
  var allEl = document.getElementById('fl-list-all');
  if (allEl) {
    var list = Object.keys(c.byUser).map(function (uid) {
      var u = c.byUser[uid], topKey = null, topN = 0;
      Object.keys(u.keys).forEach(function (k) { if (u.keys[k] > topN) { topN = u.keys[k]; topKey = k; } });
      var t = foodCat(topKey);
      return { uid: uid, n: u.total, top: t ? t.label : '—' };
    }).sort(function (a, b) { return b.n - a.n; });
    allEl.innerHTML = list.length
      ? list.map(function (r, i) {
          return tallyRowHtml(r.uid, i + 1, r.n, 'Most eaten: ' + escapeHtml(r.top), 'eaten');
        }).join('')
      : emptyBoardHtml('Nobody Yet', 'No snacks logged so far.');
  }

  renderFoodLogPanel();
}

function renderFoodLogPanel() {
  var el = document.getElementById('fl-log');
  if (!el) return;
  var cat = foodCat(foodSel);

  if (!STATE.currentUser) {
    el.className = 'tly-log';
    el.innerHTML = '<div><div class="tly-log-t">Keep your own count</div>' +
      '<div class="tly-log-s">Create a free account, check in at a park, and start tallying.</div></div>' +
      '<div class="tly-log-btns"><button class="tly-tap" onclick="openOverlay(\'overlay-register\')">Create Account</button></div>';
    return;
  }

  var parks = activeParks();
  if (!parks.length) {
    el.className = 'tly-log';
    el.innerHTML = '<div><div class="tly-log-t">Not at a park right now</div>' +
      '<div class="tly-log-s">Snacks can only be tallied while you are checked in somewhere today.</div></div>' +
      '<div class="tly-log-btns"><button class="tly-tap" onclick="newCheckin()">Check In</button></div>';
    return;
  }

  el.className = 'tly-log live';
  el.innerHTML =
    '<div class="tly-log-main">' +
      '<div class="tly-here"><i></i> Checked in at ' + escapeHtml(parks[0]) + '</div>' +
      '<div class="tly-log-t">Tap what you ate</div>' +
      '<div class="tly-log-s">No restaurant, no rating, no photo. A hot dog is a hot dog wherever you bought it. ' +
      'Rating a specific item stays on Food Scores.</div>' +
    '</div>' +
    '<div class="tly-log-btns">' +
      '<button class="tly-tap" onclick="logFood(this)">' + (cat ? cat.emoji : '') + ' &#43;1 ' + escapeHtml(cat ? cat.label.replace(/s$/, '') : 'item') + '</button>' +
      '<button class="tly-tap ghost" onclick="undoFood(this)">Undo last</button>' +
    '</div>';
}

async function logFood(btn) {
  if (!STATE.currentUser) { openOverlay('overlay-register'); return; }
  if (btn && btn.disabled) return;
  var parks = activeParks();
  if (btn) btn.disabled = true;
  try {
    var res = await sb.from('food_tallies').insert({
      user_id: STATE.currentUser.id, food_key: foodSel, park: parks[0] || null
    });
    if (res.error) {
      toast(tallyError(res.error, 'You need an active check-in today to tally a snack.'), 'error');
      return;
    }
    await loadData();
    showView('foodlb');
    var cat = foodCat(foodSel);
    toast((cat ? cat.label.replace(/s$/, '') : 'Item') + ' logged!');
  } finally {
    if (btn) btn.disabled = false;
  }
}

/* A mis-tap on a public board needs a way back, and deleting your own most
   recent row of this category is the least surprising version of that. */
async function undoFood(btn) {
  if (!STATE.currentUser) return;
  if (btn && btn.disabled) return;
  var mine = (STATE.foodTallies || []).filter(function (t) {
    return t.userId === STATE.currentUser.id && t.foodKey === foodSel;
  }).sort(function (a, b) { return b.ts - a.ts; });
  if (!mine.length) { toast('Nothing to undo for that one.', 'info'); return; }
  if (btn) btn.disabled = true;
  try {
    var res = await sb.from('food_tallies').delete().eq('id', mine[0].id).eq('user_id', STATE.currentUser.id);
    if (res.error) { toast('Could not undo: ' + res.error.message, 'error'); return; }
    await loadData();
    showView('foodlb');
    toast('Removed one.', 'info');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ============================================================
// VIEW ENTRY POINTS
// ============================================================
function renderRidesView() {
  var sel = document.getElementById('rl-park');
  if (sel && !sel.options.length) {
    sel.innerHTML = '<option value="all">All Parks</option>' +
      '<option value="disney">Disney World</option>' +
      '<option value="universal">Universal</option>';
  }
  renderRideBoards();
}

function renderFoodLbView() { renderFoodBoards(); }
