/* Turnstiles - live wait times from themeparks.wiki
 *
 * Disney publishes no public API; their app talks to an internal authenticated
 * endpoint. themeparks.wiki is a free third-party aggregator that covers all
 * ten parks this app knows about. No key, no signup, and it sends
 * `access-control-allow-origin: *`, so the browser calls it directly and this
 * needs no serverless function.
 *
 * THIS FILE IS THE WHOLE THIRD-PARTY DEPENDENCY. If themeparks.wiki ever goes
 * away, delete this file, drop the Live tab markup, and the user-submitted
 * wait times carry on untouched.
 *
 * The one rule that matters: none of this may ever be folded into loadData()
 * in supabase-food.js. That function is a single Promise.all over every table,
 * so one rejection takes down the entire app's data. This is a third-party
 * endpoint that will fail eventually, so it stays isolated and every caller
 * handles a null.
 */

var TP_BASE = 'https://api.themeparks.wiki/v1/entity/';

// keyed by the EXACT park name strings the rest of the app uses (the
// <option>s in #wt-park, the keys of RIDES_BY_PARK, and wait_times.park)
var TP_PARK_IDS = {
  'Magic Kingdom':             '75ea578a-adc8-4116-a54d-dccb60765ef9',
  'EPCOT':                     '47f90d2c-e191-4239-a466-5892ef59a88b',
  'Hollywood Studios':         '288747d1-8b4f-4a64-867e-ea7c9b27bad8',
  'Animal Kingdom':            '1c84a229-8862-4648-9c71-378ddd2c7693',
  'Universal Studios Florida': 'eb3f4560-2383-4a36-9152-6b3e5ed6bc57',
  'Islands of Adventure':      '267615cc-8943-4c2a-ae2c-5da728ca591f',
  'Epic Universe':             '12dbb85b-265f-44e6-bccf-f1faa17211fc',
  'Blizzard Beach':            'ead53ea5-22e5-4095-9a83-8c29300d7c63',
  'Typhoon Lagoon':            'b070cbc5-feaa-4b87-a8c1-f94cca037a18',
  'Volcano Bay':               'fe78a026-b91b-470c-b906-9d2266b692da'
};

// Disney publishes open/closed for its two water parks but no wait numbers at
// all, so those boards show status only rather than a page of blank minutes.
var TP_NO_WAITS = { 'Blizzard Beach': true, 'Typhoon Lagoon': true };

// upstream refreshes on roughly a five minute cadence, so polling faster than
// that spends requests without buying freshness
var TP_TTL = 5 * 60 * 1000;
var tpCache = {};

/* Returns { attractions, at } or null. Never throws - callers render a
   fallback rather than breaking the page. */
async function tpFetchPark(park, force) {
  var id = TP_PARK_IDS[park];
  if (!id) return null;

  var hit = tpCache[park];
  if (!force && hit && (Date.now() - hit.at) < TP_TTL) return hit;

  try {
    var res = await fetch(TP_BASE + id + '/live');
    if (!res.ok) throw new Error('http ' + res.status);
    var data = await res.json();
    var live = (data && data.liveData) || [];
    // The API classes galleries, trails and walkthroughs as ATTRACTION too
    // (Mexico Folk Art Gallery, Discovery Island Trails). They are OPERATING
    // but carry no queue, so filtering on "has a wait" drops them.
    //
    // Anything NOT operating is kept regardless, for two reasons: a ride being
    // down or under refurbishment is exactly what a passholder wants to know,
    // and once a park shuts for the night nothing has a wait at all. Without
    // that clause the board would go blank at closing time and read as broken
    // rather than as closed.
    var attractions = live.filter(function (e) {
      if (e.entityType !== 'ATTRACTION') return false;
      if (TP_NO_WAITS[park]) return true;
      var hasWait = e.queue && e.queue.STANDBY && e.queue.STANDBY.waitTime != null;
      return hasWait || e.status !== 'OPERATING';
    });
    var out = { attractions: attractions, at: Date.now() };
    tpCache[park] = out;
    return out;
  } catch (e) {
    console.log('live wait times unavailable for ' + park + ':', e.message);
    return null;
  }
}

function tpWaitOf(e) {
  var q = e && e.queue && e.queue.STANDBY;
  return q && q.waitTime != null ? q.waitTime : null;
}

// OPERATING is the normal case and needs no chip; everything else is the
// thing a passholder actually gets burned by, so it gets said plainly
var TP_STATUS_LABEL = {
  DOWN: 'Down',
  CLOSED: 'Closed',
  REFURBISHMENT: 'Refurb'
};

/* Three wait bands, because a board of 34 identical brass numerals makes you
   read every row to find the short line, which is the one thing someone
   standing in a park actually wants.
   Three and not five: colour says which category, the bar under the row says
   how long. Five bands on parchment forced two pairs so close together that
   the distinction stopped reading, and a distinction you cannot see is just
   noise. The hues are the site's own teal, brass and oxblood rather than a
   traffic-light ramp, which belongs to no other part of this site. */
function tpTier(wait) {
  if (wait <= 25) return 1;   // walk on or close to it
  if (wait <= 55) return 2;   // worth planning around
  return 3;                   // commit to it
}

// ============================================================
// LIVE TAB
// ============================================================
var lwPark = 'Magic Kingdom';
var lwBusy = false;

function buildLwParkOptions() {
  var sel = document.getElementById('lw-park');
  if (!sel) return;
  sel.innerHTML =
    '<optgroup label="Disney World">' +
      ['Magic Kingdom', 'EPCOT', 'Hollywood Studios', 'Animal Kingdom'].map(tpOption).join('') +
    '</optgroup>' +
    '<optgroup label="Universal Orlando">' +
      ['Universal Studios Florida', 'Islands of Adventure', 'Epic Universe'].map(tpOption).join('') +
    '</optgroup>' +
    '<optgroup label="Water Parks">' +
      ['Blizzard Beach', 'Typhoon Lagoon', 'Volcano Bay'].map(tpOption).join('') +
    '</optgroup>';
  sel.value = lwPark;
}
function tpOption(p) { return '<option value="' + escapeHtml(p) + '">' + escapeHtml(p) + '</option>'; }

function setLwPark(park) {
  lwPark = park;
  renderLiveWaits();
}

function refreshLiveWaits() {
  renderLiveWaits(true);
}

async function renderLiveWaits(force) {
  var el = document.getElementById('lw-list');
  var sub = document.getElementById('lw-sub');
  if (!el || lwBusy) return;
  var sel = document.getElementById('lw-park');
  if (sel && !sel.options.length) buildLwParkOptions();
  lwBusy = true;

  // Only show the loading state when a network trip is actually coming.
  // renderWaitTimes() runs on every view switch and after every loadData, and
  // those all hit the cache, so an unconditional placeholder would flash the
  // list away for no reason.
  var hit = tpCache[lwPark];
  if (force || !hit || (Date.now() - hit.at) >= TP_TTL) {
    if (sub) sub.textContent = 'Checking...';
    el.innerHTML = '<div class="lb2-empty"><div class="lb2-empty-s">Loading live wait times...</div></div>';
  }

  try {
    var data = await tpFetchPark(lwPark, force);

    if (!data) {
      if (sub) sub.textContent = 'Unavailable';
      el.innerHTML = '<div class="lb2-empty">' +
        '<div class="lb2-empty-t">Live Waits Unavailable</div>' +
        '<div class="lb2-empty-s">The live feed did not answer just now. ' +
        'Your logged wait times are still on the other tabs.<br>' +
        '<button class="btn-sm" style="margin-top:12px" onclick="refreshLiveWaits()">Try Again</button>' +
        '</div></div>';
      return;
    }

    var rows = data.attractions.slice();
    // open rides first, longest wait at the top; anything shut sinks to the
    // bottom where it stays visible without pushing the useful rows down
    rows.sort(function (a, b) {
      var oa = a.status === 'OPERATING' ? 0 : 1;
      var ob = b.status === 'OPERATING' ? 0 : 1;
      if (oa !== ob) return oa - ob;
      return (tpWaitOf(b) || 0) - (tpWaitOf(a) || 0);
    });

    // the header answers "how busy is it" before you read a single row
    var open = rows.filter(function (e) { return e.status === 'OPERATING' && tpWaitOf(e) != null; });
    var longest = open.reduce(function (m, e) { return Math.max(m, tpWaitOf(e)); }, 0);
    if (sub) {
      var bits = ['Updated ' + timeAgo(data.at)];
      if (open.length) {
        bits.push(open.length + ' open');
        bits.push('longest ' + longest + ' min');
      }
      sub.textContent = bits.join(' ' + String.fromCharCode(183) + ' ');
    }

    if (!rows.length) {
      el.innerHTML = '<div class="lb2-empty">' +
        '<div class="lb2-empty-t">Nothing Reporting</div>' +
        '<div class="lb2-empty-s">No attractions are reporting for this park right now.</div></div>';
      return;
    }

    var note = '';
    if (TP_NO_WAITS[lwPark]) {
      note = '<div class="lw-note">Disney does not publish wait times for its water parks. ' +
        'This shows what is open and what is closed.</div>';
    } else if (!rows.some(function (e) { return tpWaitOf(e) != null && e.status === 'OPERATING'; })) {
      // say it plainly rather than leaving a wall of "Closed" to be interpreted
      note = '<div class="lw-note">Nothing is reporting a wait right now. ' +
        'This park looks closed for the day.</div>';
    }

    // every bar is measured against the longest wait in THIS park right now, so
    // the board reads as the shape of this park today rather than against some
    // fixed ceiling that would leave a quiet morning looking uniformly empty
    var peak = rows.reduce(function (m, e) {
      return e.status === 'OPERATING' ? Math.max(m, tpWaitOf(e) || 0) : m;
    }, 0);

    el.innerHTML = note + rows.map(function (e) {
      var wait = tpWaitOf(e);
      var open = e.status === 'OPERATING';
      var right, tier = '', fill = 0;
      if (open && wait != null) {
        tier = ' t' + tpTier(wait);
        // a floor of 4% so a walk-on still reads as a mark rather than nothing
        fill = peak > 0 ? Math.max(4, Math.round(wait / peak * 100)) : 0;
        right = '<div class="lw-wait"><span class="lw-min">' + wait + '</span><span class="lw-unit">min</span></div>';
      } else if (open) {
        right = '<div class="lw-chip lw-open">Open</div>';
      } else {
        right = '<div class="lw-chip lw-shut">' +
          escapeHtml(TP_STATUS_LABEL[e.status] || 'Closed') + '</div>';
      }
      return '<div class="lb2-row lw-row' + tier + (open ? '' : ' is-shut') + '"' +
          (fill ? ' style="--lw-fill:' + fill + '%"' : '') + '>' +
        '<div class="lw-name">' + escapeHtml(e.name) + '</div>' +
        right +
      '</div>';
    }).join('');
  } finally {
    lwBusy = false;
  }
}
