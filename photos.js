// ============================================================
// COMMUNITY PHOTOS + CHECK-IN PHOTOS
// ============================================================
// The gallery (`photos`) holds only what somebody chose to share. A
// check-in photo always lands in `checkin_photos`, which only its owner
// can read, and goes to the gallery as well only when "Share to
// Community Photos" is ticked, now or later from Visit History. Food
// and festival review photos stay on their reviews and never reach the
// gallery. See supabase/photos-rework.sql.
//
// Overrides renderPhotos/openPhotoView from main.js (loaded later, so
// these definitions win).

var pvOrder = [];      // gallery ids in the order currently on screen, for prev/next
var pvIndex = -1;

function myId() { return STATE.currentUser ? STATE.currentUser.id : null; }

function photoLikeCount(photoId) {
  return (STATE.photoLikes || []).filter(function (l) { return l.photoId === photoId; }).length;
}
function likedByMe(photoId) {
  var me = myId();
  return !!me && (STATE.photoLikes || []).some(function (l) { return l.photoId === photoId && l.userId === me; });
}

// Older rows got a caption made up for them ("At EPCOT", "Check-in at
// EPCOT"), which only repeats the park. Show a caption only when a
// person wrote it.
function realCaption(p) {
  var c = (p.caption || '').trim();
  if (!c || c === 'At ' + p.park || c === 'Check-in at ' + p.park) return '';
  return c;
}

function galleryPhotos() {
  var blocked = typeof blockedIds === 'function' ? blockedIds() : {};
  var photos = (STATE.photos || []).filter(function (p) { return !blocked[p.userId]; })
    .sort(function (a, b) { return b.ts - a.ts; });
  if (photoFilter !== 'all') {
    var parks = (photoFilter === 'disney' || photoFilter === 'universal') ? LB_GROUPS[photoFilter].parks : [photoFilter];
    photos = photos.filter(function (p) { return parks.indexOf(p.park) !== -1; });
  }
  return photos;
}

function renderPhotos() {
  var el = document.getElementById('photos-grid');
  var photos = galleryPhotos();
  pvOrder = photos.map(function (p) { return p.id; });
  var addTile = '<div class="photo-thumb photo-add" onclick="openOverlay(\'overlay-photo\')">' +
    '<i class="ti ti-camera-plus"></i><span>Share a photo</span></div>';
  if (!photos.length) {
    el.innerHTML = '<div style="grid-column:1/-1"><div class="empty-state"><div class="empty-state-icon">📸</div>' +
      '<div class="empty-state-title">No Photos Yet</div><div class="empty-state-sub">' +
      (photoFilter === 'all' ? 'Be the first to share a photo from the parks!' : 'No photos from this park yet. Be the first!') +
      '</div></div></div>' + addTile;
    return;
  }
  el.innerHTML = photos.map(function (p, i) {
    var src = safeImageUrl(p.dataUrl);
    var likes = photoLikeCount(p.id);
    return '<div class="photo-thumb" style="background:' + (src ? '#000' : PHOTO_BG[i % PHOTO_BG.length]) + ';border:1px solid var(--border)" onclick="openPhotoView(\'' + p.id + '\')">' +
      (src ? '<img alt="Photo shared by a passholder" loading="lazy" src="' + escapeHtml(src) + '" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">'
           : '<span style="font-size:32px">' + parkEmoji(p.park) + '</span>') +
      '<div class="photo-overlay">' +
        '<span class="photo-user user-link" onclick="event.stopPropagation();openUserProfile(\'' + p.userId + '\')">' + avatarHtml(p.avatarUrl, p.avatar, 'avatar-img-inline') + ' ' + escapeHtml(p.username) + '</span>' +
        '<span class="photo-score">' + (likes ? '<i class="ti ti-heart-filled"></i> ' + likes : escapeHtml(p.park.split(' ')[0])) + '</span>' +
      '</div></div>';
  }).join('') + addTile;
}

function openPhotoView(id) {
  var p = (STATE.photos || []).find(function (x) { return x.id === id; });
  if (!p) return;
  pvIndex = pvOrder.indexOf(id);
  var src = safeImageUrl(p.dataUrl);
  var mine = myId() === p.userId;
  var caption = realCaption(p);
  var likes = photoLikeCount(p.id);
  var liked = likedByMe(p.id);
  var fromCheckin = mine && myCheckinPhotoByUrl(p.dataUrl);

  document.getElementById('pv-park').textContent = p.park;
  var navPrev = pvIndex > 0, navNext = pvIndex !== -1 && pvIndex < pvOrder.length - 1;
  document.getElementById('pv-stage').innerHTML =
    (src ? '<img id="pv-img" alt="' + escapeHtml(caption || ('Photo at ' + p.park)) + '" src="' + escapeHtml(src) + '">'
         : '<div class="pv-empty">' + parkEmoji(p.park) + '</div>') +
    (navPrev ? '<button class="pv-nav pv-prev" aria-label="Previous photo" onclick="stepPhoto(-1)"><i class="ti ti-chevron-left"></i></button>' : '') +
    (navNext ? '<button class="pv-nav pv-next" aria-label="Next photo" onclick="stepPhoto(1)"><i class="ti ti-chevron-right"></i></button>' : '');

  document.getElementById('pv-info').innerHTML =
    '<div class="pv-top">' +
      '<div class="pv-who">' +
        '<div class="feed-av" style="background:var(--coral-lt);color:var(--coral)">' + avatarHtml(p.avatarUrl, p.avatar) + '</div>' +
        '<div><span class="user-link pv-name" onclick="closeOverlay(\'overlay-photo-view\');openUserProfile(\'' + p.userId + '\')">' + escapeHtml(p.username) + '</span>' +
        '<div class="pv-meta">' + parkEmoji(p.park) + ' ' + escapeHtml(p.park) + ' · ' + escapeHtml(formatPhotoDate(p.ts)) + '</div></div>' +
      '</div>' +
      '<button class="pv-like' + (liked ? ' on' : '') + '" aria-pressed="' + liked + '" aria-label="' + (liked ? 'Unlike' : 'Like') + ' this photo" onclick="toggleLike(\'' + p.id + '\', this)">' +
        '<i class="ti ti-heart' + (liked ? '-filled' : '') + '"></i> <span>' + likes + '</span></button>' +
    '</div>' +
    (caption ? '<div class="pv-caption">' + escapeHtml(caption) + '</div>' : '') +
    '<div class="pv-actions">' +
      (mine
        ? (fromCheckin
            ? '<button class="btn-sm" onclick="unshareGalleryPhoto(\'' + p.id + '\', this)"><i class="ti ti-eye-off"></i> Remove from gallery</button><span class="pv-hint">It stays on your check-in.</span>'
            : '<button class="btn-sm danger" onclick="deleteGalleryPhoto(\'' + p.id + '\', this)"><i class="ti ti-trash"></i> Delete photo</button>')
        : (STATE.currentUser ? '<button class="btn-sm pv-report" onclick="openReport(\'photo\',\'' + p.id + '\',\'' + p.userId + '\',\'a photo by @' + escapeHtml(p.username || '') + '\')">Report photo</button>' : '')) +
    '</div>';
  openOverlay('overlay-photo-view');
}

function formatPhotoDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function stepPhoto(dir) {
  var next = pvIndex + dir;
  if (pvIndex === -1 || next < 0 || next >= pvOrder.length) return;
  openPhotoView(pvOrder[next]);
}

// arrow keys while the viewer is open; swipe on touch screens
document.addEventListener('keydown', function (e) {
  if (!document.getElementById('overlay-photo-view').classList.contains('open')) return;
  if (e.key === 'ArrowLeft') stepPhoto(-1);
  else if (e.key === 'ArrowRight') stepPhoto(1);
});
(function () {
  var x0 = null, y0 = null;
  var stage = document.getElementById('pv-stage');
  if (!stage) return;
  stage.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  stage.addEventListener('touchend', function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    x0 = null;
    // a clear sideways flick, not a scroll
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) stepPhoto(dx < 0 ? 1 : -1);
  });
})();

function tableMissing(err) {
  return err && (err.code === '42P01' || err.code === 'PGRST205' || /does not exist|schema cache/.test(err.message || ''));
}

async function toggleLike(photoId, btn) {
  var me = myId();
  if (!me) { membersOnly(); return; }
  if (btn && btn.disabled) return;
  if (btn) btn.disabled = true;
  var was = likedByMe(photoId);
  // update the screen first so the heart answers the tap straight away
  if (was) STATE.photoLikes = STATE.photoLikes.filter(function (l) { return !(l.photoId === photoId && l.userId === me); });
  else (STATE.photoLikes = STATE.photoLikes || []).push({ photoId: photoId, userId: me });
  paintLike(btn, photoId);
  var res = was
    ? await sb.from('photo_likes').delete().eq('photo_id', photoId).eq('user_id', me)
    : await sb.from('photo_likes').insert({ photo_id: photoId, user_id: me });
  if (btn) btn.disabled = false;
  if (res.error) {
    if (was) STATE.photoLikes.push({ photoId: photoId, userId: me });
    else STATE.photoLikes = STATE.photoLikes.filter(function (l) { return !(l.photoId === photoId && l.userId === me); });
    paintLike(btn, photoId);
    toast(tableMissing(res.error) ? 'Likes are not switched on yet.' : 'Could not save your like.', 'error');
    return;
  }
  renderPhotos();
}

function paintLike(btn, photoId) {
  if (!btn) return;
  var on = likedByMe(photoId);
  btn.classList.toggle('on', on);
  btn.setAttribute('aria-pressed', on);
  btn.setAttribute('aria-label', (on ? 'Unlike' : 'Like') + ' this photo');
  btn.innerHTML = '<i class="ti ti-heart' + (on ? '-filled' : '') + '"></i> <span>' + photoLikeCount(photoId) + '</span>';
}

// the file behind a photo address, for Storage removal: ".../photos/<uid>/<file>.jpg"
function storagePathFromUrl(url) {
  var m = /\/storage\/v1\/object\/public\/photos\/(.+)$/.exec(url || '');
  return m ? decodeURIComponent(m[1]) : null;
}

async function deleteGalleryPhoto(photoId, btn) {
  var p = (STATE.photos || []).find(function (x) { return x.id === photoId; });
  if (!p || p.userId !== myId()) return;
  if (!confirm('Delete this photo? It will be removed for everyone.')) return;
  if (btn) btn.disabled = true;
  var res = await sb.from('photos').delete().eq('id', photoId).eq('user_id', myId());
  if (res.error) { if (btn) btn.disabled = false; toast('Could not delete: ' + res.error.message, 'error'); return; }
  // take the file down too, unless something else of yours still uses it
  var path = storagePathFromUrl(p.dataUrl);
  var stillUsed = myCheckinPhotoByUrl(p.dataUrl);
  if (path && !stillUsed) await sb.storage.from('photos').remove([path]);
  closeOverlay('overlay-photo-view');
  await loadData();
  toast('Photo deleted.');
}

async function unshareGalleryPhoto(photoId, btn) {
  var p = (STATE.photos || []).find(function (x) { return x.id === photoId; });
  if (!p || p.userId !== myId()) return;
  if (btn) btn.disabled = true;
  var res = await sb.from('photos').delete().eq('id', photoId).eq('user_id', myId());
  if (res.error) { if (btn) btn.disabled = false; toast('Could not remove it: ' + res.error.message, 'error'); return; }
  closeOverlay('overlay-photo-view');
  await loadData();
  toast('Removed from Community Photos. It is still on your check-in.');
}


// ---------- check-in photos (private) ----------

function checkinPhotosFor(checkinId) {
  return (STATE.checkinPhotos || []).filter(function (x) { return x.checkinId === checkinId; });
}
function myCheckinPhotoByUrl(url) {
  return (STATE.checkinPhotos || []).find(function (x) { return x.url === url; }) || null;
}
function sharedGalleryRow(url) {
  var me = myId();
  return (STATE.photos || []).find(function (p) { return p.userId === me && p.dataUrl === url; }) || null;
}

// Uploads a check-in photo, keeps it on the check-in, and also puts it in
// the gallery when `share` is true. Returns false if the photo was lost.
async function saveCheckinPhoto(checkinId, park, dataUrl, share) {
  var uid = myId();
  var small = await downscale(dataUrl);
  var url = await uploadPhoto(small, uid);
  if (!url) { toast('Your check-in saved, but the photo did not upload.', 'error'); return false; }
  var kept = await sb.from('checkin_photos').insert({ checkin_id: checkinId, user_id: uid, image_url: url });
  if (share) {
    var shared = await sb.from('photos').insert({ user_id: uid, park: park, image_url: url });
    if (shared.error) toast('Could not share the photo: ' + shared.error.message, 'error');
  }
  if (kept.error && !share) {
    toast(tableMissing(kept.error) ? 'Private check-in photos are not switched on yet, so the photo was not saved.' : 'Could not save the photo: ' + kept.error.message, 'error');
    return false;
  }
  return true;
}

async function shareCheckinPhoto(cpId, btn) {
  var cp = (STATE.checkinPhotos || []).find(function (x) { return x.id === cpId; });
  var c = cp && (STATE.checkins || []).find(function (x) { return x.id === cp.checkinId; });
  if (!cp || !c || sharedGalleryRow(cp.url)) return;
  if (btn) btn.disabled = true;
  var res = await sb.from('photos').insert({ user_id: myId(), park: c.park, image_url: cp.url });
  if (btn) btn.disabled = false;
  if (res.error) { toast('Could not share: ' + res.error.message, 'error'); return; }
  closeOverlay('overlay-photo-view');
  await loadData();
  toast('Shared to Community Photos!');
}

async function unshareCheckinPhoto(cpId, btn) {
  var cp = (STATE.checkinPhotos || []).find(function (x) { return x.id === cpId; });
  var row = cp && sharedGalleryRow(cp.url);
  if (row) await unshareGalleryPhoto(row.id, btn);
}

// Visit History cell: small thumbnails, each opening the private viewer
function checkinPhotoCellHtml(c) {
  var list = checkinPhotosFor(c.id);
  if (!list.length) return '<span style="color:var(--ink-faint)">—</span>';
  return '<div class="vh-photos">' + list.map(function (cp) {
    var shared = !!sharedGalleryRow(cp.url);
    return '<button class="vh-thumb" aria-label="Open photo" onclick="openCheckinPhoto(\'' + cp.id + '\')">' +
      '<img alt="" loading="lazy" src="' + escapeHtml(safeImageUrl(cp.url) || '') + '">' +
      (shared ? '<span class="vh-shared" title="In Community Photos"><i class="ti ti-users"></i></span>' : '') +
      '</button>';
  }).join('') + '</div>';
}

// Your own check-in photo, in the same viewer but without the gallery bits
function openCheckinPhoto(cpId) {
  var cp = (STATE.checkinPhotos || []).find(function (x) { return x.id === cpId; });
  var c = cp && (STATE.checkins || []).find(function (x) { return x.id === cp.checkinId; });
  if (!cp || !c) return;
  pvIndex = -1;
  var shared = !!sharedGalleryRow(cp.url);
  document.getElementById('pv-park').textContent = c.park;
  document.getElementById('pv-stage').innerHTML = '<img id="pv-img" alt="Your photo from ' + escapeHtml(c.park) + '" src="' + escapeHtml(safeImageUrl(cp.url) || '') + '">';
  document.getElementById('pv-info').innerHTML =
    '<div class="pv-meta" style="margin-bottom:10px">' + parkEmoji(c.park) + ' ' + escapeHtml(c.park) + ' · ' + escapeHtml(formatDate(c.date)) + '</div>' +
    '<div class="pv-private">' + (shared
      ? '<i class="ti ti-users"></i> This photo is in Community Photos, where members can see it.'
      : '<i class="ti ti-lock"></i> Only you can see this photo.') + '</div>' +
    '<div class="pv-actions">' + (shared
      ? '<button class="btn-sm" onclick="unshareCheckinPhoto(\'' + cp.id + '\', this)"><i class="ti ti-eye-off"></i> Remove from Community Photos</button>'
      : '<button class="btn-sm primary" onclick="shareCheckinPhoto(\'' + cp.id + '\', this)"><i class="ti ti-share"></i> Share to Community Photos</button>') +
    '</div>';
  openOverlay('overlay-photo-view');
}
