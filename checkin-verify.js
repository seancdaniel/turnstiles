// Location-verified check-ins. Optional, and a badge only: it gates
// nothing, the ride and food tallies still accept any same-day check-in.
//
// The distance check is NOT done here. This file only reads the device's
// position once and hands it to the verify_checkin() RPC, which holds the
// park coordinates and is the only thing allowed to set checkins.verified
// (see supabase/checkin-verify.sql). Doing the check in the browser would
// mean trusting the browser, which is the problem the column had before.
//
// Coordinates are never stored. They go to the RPC and are dropped there.

// Resolves {lat, lng, accuracy}, or rejects with an Error whose .code is
// 'unsupported', 'denied', 'unavailable' or 'timeout'.
function getDevicePosition() {
  return new Promise(function (resolve, reject) {
    function fail(code) { var e = new Error(code); e.code = code; reject(e); }
    if (!('geolocation' in navigator)) { fail('unsupported'); return; }
    navigator.geolocation.getCurrentPosition(
      function (p) { resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }); },
      function (err) { fail(err.code === 1 ? 'denied' : err.code === 3 ? 'timeout' : 'unavailable'); },
      // a fresh, precise fix: a cached one could be from before you walked in
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

function verifyFailMessage(reason, park, nearest) {
  switch (reason) {
    case 'denied':      return 'Location access is off, so this check-in stays unverified. You can allow it in your browser settings and try again from Visit History.';
    case 'unsupported': return 'This browser cannot share your location, so this check-in stays unverified.';
    case 'timeout':
    case 'unavailable': return 'Could not get your location. Try again from Visit History in a moment.';
    case 'imprecise':   return 'Your location was not precise enough to tell which park you are in. Try again in a moment.';
    case 'not_today':   return 'Only a check-in for today can be verified.';
    case 'wrong_park':  return 'Your location looks closer to ' + nearest + ' than ' + park + '.';
    case 'too_far':     return 'Your location does not look like ' + park + '. You can try again once you are inside.';
    case 'missing':     return 'Verification is not switched on yet.';
    default:            return 'Could not verify this check-in.';
  }
}

// Returns true when the check-in was verified. `btn` is optional.
async function verifyCheckin(id, btn) {
  if (!STATE.currentUser) return false;
  if (btn && btn.disabled) return false;
  var c = (STATE.checkins || []).find(function (x) { return x.id === id; });
  var park = c ? c.park : 'that park';
  var label = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Locating...'; }
  try {
    var pos;
    try { pos = await getDevicePosition(); }
    catch (e) { toast(verifyFailMessage(e.code, park), 'error'); return false; }

    var res = await sb.rpc('verify_checkin', {
      p_checkin_id: id, p_lat: pos.lat, p_lng: pos.lng, p_accuracy: pos.accuracy
    });
    if (res.error) {
      // the function not existing means checkin-verify.sql has not been run
      var missing = res.error.code === 'PGRST202' || /verify_checkin/.test(res.error.message || '');
      toast(missing ? verifyFailMessage('missing') : 'Could not verify: ' + res.error.message, 'error');
      return false;
    }
    var r = res.data || {};
    if (!r.ok) { toast(verifyFailMessage(r.reason, park, r.nearest), 'error'); return false; }
    await loadData();
    toast('Verified. You are at ' + park + '.');
    return true;
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = label; }
  }
}

// The toggle in the check-in form only makes sense for a visit dated
// today, since where you are now says nothing about a past visit.
function syncCheckinVerifyRow() {
  var row = document.getElementById('ci-verify-row');
  var date = document.getElementById('ci-date');
  if (!row || !date) return;
  var today = date.value === parkTodayStr();
  row.style.display = today ? '' : 'none';
  if (!today) document.getElementById('ci-verify').checked = false;
}

function verifiedBadgeHtml() {
  return '<span class="verified-badge" title="The device reported a location at this park on the day of the visit"><i class="ti ti-map-pin-check" aria-hidden="true"></i> Verified</span>';
}

// Visit History: badge when verified, a Verify button for today's
// unverified visits, nothing for older ones.
function checkinVerifyCellHtml(c) {
  if (c.verified) return verifiedBadgeHtml();
  if (c.date === parkTodayStr()) {
    return '<button class="btn-sm" onclick="verifyCheckin(\'' + c.id + '\', this)"><i class="ti ti-map-pin" aria-hidden="true"></i> Verify</button>';
  }
  return '';
}
