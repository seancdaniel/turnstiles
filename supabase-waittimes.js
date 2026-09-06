/* Turnstiles - wait times: posted vs. actual, per ride, "today" feed + "yesterday" averages */

var RIDES_BY_PARK = {
  'Magic Kingdom': [
    'Seven Dwarfs Mine Train', 'Space Mountain', 'Big Thunder Mountain Railroad',
    "Tiana's Bayou Adventure", 'Pirates of the Caribbean', 'Haunted Mansion', 'Jungle Cruise',
    "It's a Small World", "Peter Pan's Flight", 'The Many Adventures of Winnie the Pooh',
    'Under the Sea - Journey of the Little Mermaid', "Buzz Lightyear's Space Ranger Spin",
    'TRON Lightcycle / Run', 'Astro Orbiter', 'The Barnstormer', 'Dumbo the Flying Elephant',
    'Mad Tea Party', "Walt Disney's Enchanted Tiki Room", 'Magic Carpets of Aladdin',
    'Liberty Square Riverboat', 'Prince Charming Regal Carrousel', "Mickey's PhilharMagic",
    'Tomorrowland Speedway', "Walt Disney's Carousel of Progress", 'Monsters, Inc. Laugh Floor',
    'Walt Disney World Railroad'
  ],
  'EPCOT': [
    'Guardians of the Galaxy: Cosmic Rewind', 'Test Track', 'Mission: SPACE', 'Frozen Ever After',
    "Remy's Ratatouille Adventure", "Soarin' Around the World", 'Living with the Land',
    'Spaceship Earth', 'The Seas with Nemo & Friends', 'Journey Into Imagination with Figment',
    'Gran Fiesta Tour Starring The Three Caballeros'
  ],
  'Hollywood Studios': [
    'Star Wars: Rise of the Resistance', 'Millennium Falcon: Smugglers Run',
    "Mickey & Minnie's Runaway Railway", 'Slinky Dog Dash', 'Toy Story Mania!',
    'Alien Swirling Saucers', "Rock 'n' Roller Coaster", 'The Twilight Zone Tower of Terror',
    'Star Tours - The Adventures Continue', 'Muppet*Vision 3D'
  ],
  'Animal Kingdom': [
    'Avatar Flight of Passage', "Na'vi River Journey", 'Expedition Everest',
    'Kilimanjaro Safaris', 'Kali River Rapids', 'DINOSAUR', "It's Tough to Be a Bug!",
    'TriceraTop Spin'
  ],
  'Universal Studios Florida': [
    'Harry Potter and the Escape from Gringotts', 'Revenge of the Mummy',
    'Transformers: The Ride 3D', 'MEN IN BLACK Alien Attack', 'E.T. Adventure',
    'Hollywood Rip Ride Rockit', 'Fast & Furious: Supercharged', "Kang & Kodos' Twirl 'n' Hurl",
    'Despicable Me Minion Mayhem', 'Race Through New York Starring Jimmy Fallon',
    "Woody Woodpecker's Nuthouse Coaster"
  ],
  'Islands of Adventure': [
    'Harry Potter and the Forbidden Journey', "Hagrid's Magical Creatures Motorbike Adventure",
    'Jurassic World VelociCoaster', 'Jurassic Park River Adventure',
    'The Amazing Adventures of Spider-Man', 'Skull Island: Reign of Kong', "Doctor Doom's Fearfall",
    'The Incredible Hulk Coaster', "Popeye & Bluto's Bilge-Rat Barges", "Dudley Do-Right's Ripsaw Falls",
    'Flight of the Hippogriff', 'Storm Force Accelatron', 'Pteranodon Flyers',
    'The Cat in the Hat', 'One Fish, Two Fish, Red Fish, Blue Fish', 'Caro-Seuss-el',
    'The High in the Sky Seuss Trolley Train Ride!'
  ],
  'Epic Universe': [
    'Stardust Racers', 'Curse of the Werewolf', 'Monsters Unchained: The Frankenstein Experiment',
    'Harry Potter and the Battle at the Ministry', 'Constellation Carousel',
    "Mario Kart: Bowser's Challenge", "Yoshi's Adventure", "Hiccup's Wing Gliders",
    "Dragon Racer's Rally"
  ],
  'Blizzard Beach': [
    'Summit Plummet', 'Slush Gusher', 'Teamboat Springs', 'Snow Stormers', 'Toboggan Racers',
    'Runoff Rapids'
  ],
  'Typhoon Lagoon': [
    "Crush 'n' Gusher", 'Humunga Kowabunga', 'Mayday Falls', 'Keelhaul Falls', 'Bay Slides',
    'Gang Plank Falls'
  ],
  'Volcano Bay': [
    'Krakatau Aqua Coaster', "Ko'okiri Body Plunge", 'Puihi', 'Taniwha Tubes',
    'Kala & Tai Nui Serpentine Body Slides', 'Honu ika Moana', 'Ohyah and Ohno', 'Maku',
    'Punga Racers'
  ]
};

// The ride list is built from the live feed rather than RIDES_BY_PARK, which
// had already drifted: only 84 of its 101 names still matched, and some of the
// misses were real closures (DINOSAUR, TriceraTop Spin) rather than wording.
// RIDES_BY_PARK stays below as the offline fallback.
async function updateRideOptions() {
  var park = document.getElementById('wt-park').value;
  var sel = document.getElementById('wt-ride');
  clearPostedFill();
  if (!park) { sel.innerHTML = '<option value="">Choose a park first</option>'; return; }

  sel.innerHTML = '<option value="">Loading rides...</option>';
  sel.disabled = true;
  var data = typeof tpFetchPark === 'function' ? await tpFetchPark(park) : null;
  sel.disabled = false;

  // a park change while this was in flight wins - do not stomp the newer list
  if (document.getElementById('wt-park').value !== park) return;

  var opts;
  if (data && data.attractions.length) {
    opts = data.attractions.slice().sort(function (a, b) {
      return a.name.localeCompare(b.name);
    }).map(function (e) {
      var wait = tpWaitOf(e);
      var live = (wait != null && e.status === 'OPERATING') ? ' data-tp-wait="' + wait + '"' : '';
      return '<option value="' + escapeHtml(e.name) + '" data-tp-id="' + escapeHtml(e.id) + '"' +
        live + '>' + escapeHtml(e.name) + '</option>';
    }).join('');
  } else {
    opts = (RIDES_BY_PARK[park] || []).map(function (r) {
      return '<option>' + escapeHtml(r) + '</option>';
    }).join('');
  }
  sel.innerHTML = '<option value="">Select a ride...</option>' + opts;
}

function clearPostedFill() {
  var posted = document.getElementById('wt-posted');
  var note = document.getElementById('wt-posted-note');
  if (posted) { posted.value = ''; posted.classList.remove('is-autofilled'); }
  if (note) note.style.display = 'none';
}

// Pre-fill the posted wait from the live feed and say so. It stays editable on
// purpose: the sign in front of the ride is the source of truth, and the feed
// can be a few minutes behind it. Actual Wait is never guessed at - that is the
// number this whole page exists to collect.
function handleRideSelect() {
  var sel = document.getElementById('wt-ride');
  var opt = sel.options[sel.selectedIndex];
  var posted = document.getElementById('wt-posted');
  var note = document.getElementById('wt-posted-note');
  clearPostedFill();
  if (!opt) return;
  var wait = opt.getAttribute('data-tp-wait');
  if (wait == null) return;
  posted.value = wait;
  posted.classList.add('is-autofilled');
  if (note) note.style.display = 'block';
}

function isSameLocalDay(ts, dayOffset) {
  var d = new Date(ts);
  var ref = new Date();
  ref.setDate(ref.getDate() + dayOffset);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth() && d.getDate() === ref.getDate();
}

async function submitWaitTime(btn) {
  if (!STATE.currentUser) { openOverlay('overlay-register'); return; }
  if (btn && btn.disabled) return; // see submitCheckin - same double-click guard
  var park = document.getElementById('wt-park').value;
  var sel = document.getElementById('wt-ride');
  var ride = sel.value;
  var opt = sel.options[sel.selectedIndex];
  // the feed's stable id, so a later rename does not split this ride's history
  var rideId = opt ? opt.getAttribute('data-tp-id') : null;
  var posted = parseInt(document.getElementById('wt-posted').value, 10);
  var actual = parseInt(document.getElementById('wt-actual').value, 10);
  if (!park || !ride) { toast('Pick a park and a ride.', 'error'); return; }
  if (isNaN(posted) || isNaN(actual) || posted < 0 || actual < 0) { toast('Enter both wait times in minutes.', 'error'); return; }
  if (btn) btn.disabled = true;
  try {
    var row = { user_id: STATE.currentUser.id, park: park, ride: ride, ride_id: rideId || null, posted_wait: posted, actual_wait: actual };
    var res = await sb.from('wait_times').insert(row);
    // Vercel deploys the moment this is pushed, but the ride_id migration is
    // run by hand afterwards. Rather than leave logging broken in that window,
    // fall back to the old shape if the column is not there yet.
    if (res.error && /ride_id/.test(res.error.message || '')) {
      delete row.ride_id;
      res = await sb.from('wait_times').insert(row);
    }
    if (res.error) { toast('Could not save: ' + res.error.message, 'error'); return; }
    closeOverlay('overlay-wait-time');
    document.getElementById('wt-park').value = '';
    document.getElementById('wt-ride').innerHTML = '<option value="">Choose a park first</option>';
    document.getElementById('wt-actual').value = '';
    clearPostedFill();
    await loadData();
    showView('waittimes');
    toast(ride + ' wait time logged!');
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function deleteWaitTime(id) {
  if (!STATE.currentUser) return;
  if (!confirm('Delete this wait time entry?')) return;
  var res = await sb.from('wait_times').delete().eq('id', id).eq('user_id', STATE.currentUser.id);
  if (res.error) { toast('Could not delete: ' + res.error.message, 'error'); return; }
  await loadData();
  showView('waittimes');
  toast('Wait time deleted.');
}

var waitTimesTab = 'live';
function switchWaitTimesTab(btn, tab) {
  waitTimesTab = tab;
  document.querySelectorAll('#view-waittimes .page-tab').forEach(function (b) { b.classList.remove('active'); });
  btn.classList.add('active');
  ['live', 'today', 'yesterday'].forEach(function (t) {
    var el = document.getElementById('wttab-' + t);
    if (el) el.style.display = tab === t ? 'block' : 'none';
  });
  if (tab === 'live') renderLiveWaits();
}

function renderWaitTimes() {
  // Live is deliberately NOT awaited and its failure is swallowed inside
  // renderLiveWaits - a third-party outage must never stop the two boards
  // below from rendering the community's own data.
  if (typeof renderLiveWaits === 'function') renderLiveWaits();
  renderWaitTimesToday();
  renderWaitTimesYesterday();
}

function renderWaitTimesToday() {
  var el = document.getElementById('wt-today-list');
  if (!el) return;
  var today = STATE.waitTimes.filter(function (w) { return isSameLocalDay(w.ts, 0); })
    .sort(function (a, b) { return b.ts - a.ts; });
  if (!today.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">⏱️</div><div class="empty-state-title">No Wait Times Logged Today</div><div class="empty-state-sub">Be the first to log one from the line!</div></div>';
    return;
  }
  el.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px">' +
    today.map(function (w) {
      var mine = STATE.currentUser && w.userId === STATE.currentUser.id;
      return '<div class="feed-card">' +
        '<div class="feed-top">' +
          '<div class="feed-user-link user-link" onclick="openUserProfile(\'' + w.userId + '\')" style="display:flex;align-items:flex-start;gap:10px;flex:1;min-width:0">' +
            '<div class="feed-av" style="background:var(--coral-lt);color:var(--coral)">' + avatarHtml(w.avatarUrl, w.avatar) + '</div>' +
            '<div class="feed-meta">' +
              '<div class="feed-username">' + escapeHtml(w.username) + '</div>' +
              '<div class="feed-parkname">' + parkEmoji(w.park) + ' ' + escapeHtml(w.ride) + ' · ' + escapeHtml(w.park) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="feed-time">' + timeAgo(w.ts) + '</div>' +
        '</div>' +
        '<div class="feed-pills">' +
          '<span class="pill pill-walk"><i class="ti ti-clipboard-list"></i> Posted ' + w.postedWait + ' min</span>' +
          '<span class="pill pill-score"><i class="ti ti-clock"></i> Actual ' + w.actualWait + ' min</span>' +
          (mine ? '<button class="btn-sm danger" onclick="deleteWaitTime(\'' + w.id + '\')" style="margin-left:auto">Delete</button>' : '') +
        '</div>' +
      '</div>';
    }).join('') + '</div>';
}

function renderWaitTimesYesterday() {
  var el = document.getElementById('wt-yesterday-list');
  if (!el) return;
  var yesterday = STATE.waitTimes.filter(function (w) { return isSameLocalDay(w.ts, -1); });
  if (!yesterday.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-sub">No wait times were logged yesterday.</div></div>';
    return;
  }
  var map = {};
  yesterday.forEach(function (w) {
    // group on the feed's id when we have it, so a ride being renamed upstream
    // does not silently split its history into two half-length averages
    var key = w.park + '|' + (w.rideId || w.ride);
    if (!map[key]) map[key] = { park: w.park, ride: w.ride, posted: [], actual: [] };
    map[key].posted.push(w.postedWait);
    map[key].actual.push(w.actualWait);
  });
  var avg = function (arr) { return Math.round(arr.reduce(function (a, b) { return a + b; }, 0) / arr.length); };
  var rows = Object.keys(map).map(function (k) {
    var m = map[k];
    return { park: m.park, ride: m.ride, count: m.posted.length, avgPosted: avg(m.posted), avgActual: avg(m.actual) };
  }).sort(function (a, b) { return b.count - a.count; });
  el.innerHTML = rows.map(function (r) {
    return '<div class="food-item">' +
      '<div class="food-emoji">' + parkEmoji(r.park) + '</div>' +
      '<div class="food-info"><div class="food-name">' + escapeHtml(r.ride) + '</div><div class="food-loc">' + escapeHtml(r.park) + ' · ' + r.count + ' report' + (r.count === 1 ? '' : 's') + '</div></div>' +
      '<div class="food-score-block"><div class="food-score-num">' + r.avgPosted + '<span style="font-size:14px;color:var(--ink-faint)"> / ' + r.avgActual + '</span></div><div class="food-rev-count">posted / actual</div></div>' +
      '</div>';
  }).join('');
}
