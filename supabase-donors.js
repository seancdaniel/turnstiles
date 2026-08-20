/* Turnstiles - Thank You page: public donor wall + admin-only add/remove.
   Does NOT re-override loadData() - STATE.donors is populated in
   supabase-food.js's loadData(), which owns the combined fetch (see NOTES.md). */

var donorAddMode = 'user'; // 'user' | 'name' - which half of the admin form is active
var dnPickedUserId = null;
var dnPickedUsername = '';

function switchDonorMode(mode) {
  donorAddMode = mode;
  document.getElementById('dn-mode-user').classList.toggle('active', mode === 'user');
  document.getElementById('dn-mode-name').classList.toggle('active', mode === 'name');
  document.getElementById('dn-user-fields').style.display = mode === 'user' ? 'block' : 'none';
  document.getElementById('dn-name-field').style.display = mode === 'name' ? 'block' : 'none';
}

function donorUserSearch() {
  var q = document.getElementById('dn-search').value.trim().toLowerCase();
  var box = document.getElementById('dn-results');
  if (q.length < 2) { box.innerHTML = ''; box.style.display = 'none'; return; }
  var matches = (STATE.users || []).filter(function (u) {
    return u.username.toLowerCase().indexOf(q) >= 0;
  }).slice(0, 8);
  if (!matches.length) { box.innerHTML = '<div class="fr-result">No matching accounts</div>'; box.style.display = 'block'; return; }
  box.innerHTML = matches.map(function (u) {
    return '<div class="fr-result" data-id="' + u.id + '" data-u="' + encodeURIComponent(u.username) + '" onclick="donorPickEl(this)">' +
      '<span class="fr-r-name">' + avatarHtml(u.avatarUrl, u.avatar, 'avatar-img-inline') + ' ' + escapeHtml(u.username) + '</span>' +
      '</div>';
  }).join('');
  box.style.display = 'block';
}

function donorPickEl(el) {
  dnPickedUserId = el.getAttribute('data-id');
  dnPickedUsername = decodeURIComponent(el.getAttribute('data-u'));
  document.getElementById('dn-search').value = dnPickedUsername;
  document.getElementById('dn-results').style.display = 'none';
  var picked = document.getElementById('dn-picked');
  picked.innerHTML = 'Adding <strong>@' + escapeHtml(dnPickedUsername) + '</strong> <a onclick="donorClearPick()">change</a>';
  picked.style.display = 'block';
}

function donorClearPick() {
  dnPickedUserId = null;
  dnPickedUsername = '';
  document.getElementById('dn-search').value = '';
  var picked = document.getElementById('dn-picked'); if (picked) picked.style.display = 'none';
}

function resetDonorForm() {
  switchDonorMode('user');
  donorClearPick();
  var nameEl = document.getElementById('dn-name'); if (nameEl) nameEl.value = '';
}

async function submitDonor() {
  if (!STATE.currentUser || !STATE.currentUser.isAdmin) return;
  var row;
  if (donorAddMode === 'user') {
    if (!dnPickedUserId) { toast('Search for and pick an account first.', 'error'); return; }
    row = { user_id: dnPickedUserId, display_name: dnPickedUsername };
  } else {
    var name = document.getElementById('dn-name').value.trim();
    if (!name) { toast('Enter a name to display.', 'error'); return; }
    row = { user_id: null, display_name: name };
  }
  var res = await sb.from('donors').insert(row);
  if (res.error) { toast('Could not add donor: ' + res.error.message, 'error'); return; }
  resetDonorForm();
  await loadData();
  toast('Donor added - thank you!');
}

async function deleteDonor(id) {
  if (!STATE.currentUser || !STATE.currentUser.isAdmin) return;
  var res = await sb.from('donors').delete().eq('id', id);
  if (res.error) { toast('Could not remove: ' + res.error.message, 'error'); return; }
  await loadData();
}

function donorChipHtml(d) {
  var isAdmin = STATE.currentUser && STATE.currentUser.isAdmin;
  var removeBtn = isAdmin ? '<span class="donor-chip-remove" title="Remove" onclick="event.stopPropagation();deleteDonor(\'' + d.id + '\')"><i class="ti ti-x"></i></span>' : '';
  if (d.userId) {
    return '<div class="donor-chip linked" onclick="openUserProfile(\'' + d.userId + '\')">' +
      '<span class="donor-chip-av">' + avatarHtml(d.avatarUrl, d.avatar) + '</span>' +
      '<span class="donor-chip-name">@' + escapeHtml(d.username || d.displayName) + '</span>' +
      removeBtn + '</div>';
  }
  return '<div class="donor-chip">' +
    '<span class="donor-chip-av">🎗️</span>' +
    '<span class="donor-chip-name">' + escapeHtml(d.displayName) + '</span>' +
    removeBtn + '</div>';
}

function renderThanks() {
  var isAdmin = !!(STATE.currentUser && STATE.currentUser.isAdmin);
  var panel = document.getElementById('donor-admin-panel');
  if (panel) panel.style.display = isAdmin ? 'block' : 'none';

  var donors = (STATE.donors || []).slice().sort(function (a, b) { return b.ts - a.ts; });
  var wall = document.getElementById('donor-wall');
  if (!wall) return;
  if (!donors.length) {
    wall.innerHTML = '<div class="donor-empty">No donors yet - be the first! The Margarita Fund link is on the <a onclick="showView(\'about\')">About page</a>.</div>';
    return;
  }
  wall.innerHTML = donors.map(donorChipHtml).join('');
}
