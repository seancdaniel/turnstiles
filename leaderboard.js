/* Turnstiles - leaderboard: Disney / Universal groups + per-park sub-boards */

var LB_GROUPS = {
  all: { label: 'All Parks', parks: null },
  disney: { label: 'Disney', parks: ['Magic Kingdom', 'EPCOT', 'Hollywood Studios', 'Animal Kingdom', 'Blizzard Beach', 'Typhoon Lagoon'] },
  universal: { label: 'Universal', parks: ['Universal Studios Florida', 'Islands of Adventure', 'Epic Universe', 'Volcano Bay'] }
};
var lbResort = 'all';
var lbPeriod = 'all'; // 'all' | 'month' | 'year' — matches the two-track rank tiers (checkinsThisMonth/checkinsThisYear)

function buildLeaderboard(filter, period) {
  var parks = null;
  if (filter === 'disney' || filter === 'universal') parks = LB_GROUPS[filter].parks;
  else if (filter !== 'all') parks = [filter];

  var now = new Date();
  var y = now.getFullYear(), m = now.getMonth();

  return STATE.users.map(function (u) {
    var mine = STATE.checkins.filter(function (c) {
      if (c.userId !== u.id) return false;
      if (parks && parks.indexOf(c.park) < 0) return false;
      if (period === 'month' || period === 'year') {
        if (!c.date) return false;
        var d = new Date(c.date + 'T00:00:00');
        if (d.getFullYear() !== y) return false;
        if (period === 'month' && d.getMonth() !== m) return false;
      }
      return true;
    });
    return { userId: u.id, username: u.username, avatar: u.avatar, avatarUrl: u.avatarUrl, fname: u.fname, visits: mine.length };
  }).sort(function (a, b) { return b.visits - a.visits; });
}

function selectLbPeriod(period) {
  lbPeriod = period;
  renderLbPeriodTabs();
  renderLeaderboard();
}

function renderLbPeriodTabs() {
  ['month', 'year', 'all'].forEach(function (p) {
    var b = document.getElementById('lb-period-' + p);
    if (b) b.className = 'lb-tab' + (lbPeriod === p ? ' active' : '');
  });
}

function selectResort(resort) {
  lbResort = resort;
  lbFilter = resort;
  renderLbResortTabs();
  renderLbParkTabs();
  renderLeaderboard();
}

function selectLbPark(filter) {
  lbFilter = filter;
  renderLbParkTabs();
  renderLeaderboard();
}

function renderLbResortTabs() {
  ['all', 'disney', 'universal'].forEach(function (g) {
    var b = document.getElementById('lb-btn-' + g);
    if (b) b.className = 'lb-tab' + (lbResort === g ? ' active' : '');
  });
}

function renderLbParkTabs() {
  var row = document.getElementById('lb-park-row');
  if (!row) return;
  if (lbResort === 'all') { row.innerHTML = ''; row.style.display = 'none'; return; }
  row.style.display = 'flex';
  var g = LB_GROUPS[lbResort];
  var items = [{ v: lbResort, label: 'Overall ' + g.label }];
  g.parks.forEach(function (p) { items.push({ v: p, label: p }); });
  row.innerHTML = items.map(function (it) {
    var active = (lbFilter === it.v) ? ' active' : '';
    return '<button class="lb-tab' + active + '" onclick="selectLbPark(\'' + it.v + '\')">' + escapeHtml(it.label) + '</button>';
  }).join('');
}
