/* Turnstiles - leaderboard: Disney / Universal groups + per-park sub-boards */

var LB_GROUPS = {
  all: { label: 'All Parks', parks: null },
  disney: { label: 'Disney', parks: ['Magic Kingdom', 'EPCOT', 'Hollywood Studios', 'Animal Kingdom', 'Blizzard Beach', 'Typhoon Lagoon'] },
  universal: { label: 'Universal', parks: ['Universal Studios Florida', 'Islands of Adventure', 'Epic Universe', 'Volcano Bay'] }
};
var lbResort = 'all';

function buildLeaderboard(filter) {
  var parks = null;
  if (filter === 'disney' || filter === 'universal') parks = LB_GROUPS[filter].parks;
  else if (filter !== 'all') parks = [filter];
  return STATE.users.map(function (u) {
    var mine = STATE.checkins.filter(function (c) {
      if (c.userId !== u.id) return false;
      if (parks && parks.indexOf(c.park) < 0) return false;
      return true;
    });
    return { userId: u.id, username: u.username, avatar: u.avatar, fname: u.fname,
      visits: mine.length, tier: getTier(STATE.checkins.filter(function (c) { return c.userId === u.id; }).length).name };
  }).sort(function (a, b) { return b.visits - a.visits; });
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
