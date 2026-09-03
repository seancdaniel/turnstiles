/* Turnstiles - leaderboard: Disney / Universal groups + per-park sub-boards */

var LB_GROUPS = {
  all: { label: 'All Parks', parks: null },
  disney: { label: 'Disney', parks: ['Magic Kingdom', 'EPCOT', 'Hollywood Studios', 'Animal Kingdom', 'Blizzard Beach', 'Typhoon Lagoon'] },
  universal: { label: 'Universal', parks: ['Universal Studios Florida', 'Islands of Adventure', 'Epic Universe', 'Volcano Bay'] }
};
// Each board keeps its own park filter, so Monthly and Yearly can be looked
// at side by side rather than one at a time behind a period selector.
var lbPark = { month: 'all', year: 'all' };

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

// one <select> per board, built from LB_GROUPS so it cannot drift from the
// groups the filter itself uses
function buildLbParkOptions(period) {
  var sel = document.getElementById('lb-park-' + period);
  if (!sel) return;
  var html = '<option value="all">All Parks</option>';
  ['disney', 'universal'].forEach(function (g) {
    html += '<optgroup label="' + LB_GROUPS[g].label + '">';
    html += '<option value="' + g + '">All ' + LB_GROUPS[g].label + '</option>';
    LB_GROUPS[g].parks.forEach(function (p) {
      html += '<option value="' + escapeHtml(p) + '">' + escapeHtml(p) + '</option>';
    });
    html += '</optgroup>';
  });
  sel.innerHTML = html;
  sel.value = lbPark[period];
}

function setLbPark(period, value) {
  lbPark[period] = value;
  renderLeaderboardBoard(period);
}

function lbParkLabel(period) {
  var v = lbPark[period];
  if (v === 'all') return 'All parks';
  if (LB_GROUPS[v]) return 'All ' + LB_GROUPS[v].label;
  return v;
}

function renderLeaderboardBoard(period) {
  var el = document.getElementById('lb-list-' + period);
  if (!el) return;

  // people with nothing logged in the period are not really on the board -
  // a monthly list padded with a long tail of zeros is the readability
  // problem this redesign was meant to fix
  var rows = buildLeaderboard(lbPark[period], period).filter(function (r) { return r.visits > 0; });

  var sub = document.getElementById('lb-sub-' + period);
  if (sub) sub.textContent = lbParkLabel(period) + ' \u00B7 ' + rows.length + ' passholder' + (rows.length === 1 ? '' : 's');

  if (!rows.length) {
    el.innerHTML = '<div class="lb2-empty">' +
      '<div class="lb2-empty-t">Nobody yet</div>' +
      '<div class="lb2-empty-s">No check-ins logged here ' +
      (period === 'month' ? 'this month.' : 'this year.') + '</div></div>';
    return;
  }

  var me = STATE.currentUser;
  el.innerHTML = rows.map(function (r, i) {
    var isYou = me && r.userId === me.id;
    // only this board's own ladder - showing both was noise
    var tier = period === 'month'
      ? getMonthlyTier(checkinsThisMonth(r.userId))
      : getYearlyTier(checkinsThisYear(r.userId));
    var medal = i === 0 ? ' g1' : i === 1 ? ' g2' : i === 2 ? ' g3' : '';
    return '<div class="lb2-row' + (isYou ? ' you' : '') + '" tabindex="0" role="button"' +
      ' onclick="openUserProfile(\'' + r.userId + '\')"' +
      ' onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();openUserProfile(\'' + r.userId + '\');}">' +
      '<div class="lb2-rank' + medal + '">' + (i + 1) + '</div>' +
      '<div class="lb2-av">' + avatarHtml(r.avatarUrl, r.avatar) + '</div>' +
      '<div class="lb2-info">' +
        '<span class="lb2-name">' + escapeHtml(r.username) + '</span>' +
        (isYou ? '<span class="lb2-you">You</span>' : '') +
        tierEmblem(tier, period === 'month' ? 'Monthly' : 'Yearly') +
      '</div>' +
      '<div class="lb2-visits">' + r.visits + '</div>' +
    '</div>';
  }).join('');
}

function renderLeaderboard() {
  buildLbParkOptions('month');
  buildLbParkOptions('year');
  renderLeaderboardBoard('month');
  renderLeaderboardBoard('year');
}
