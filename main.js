/* Turnstiles — main.js */

// ============================================================
// STATE
// ============================================================
const STATE = {
  currentUser: null,
  users: [],         // {id, username, fname, lname, email, password, avatar, bio, location, parks, joinYear}
  checkins: [],      // {id, userId, park, date, miles, foods, score, review, photo, ts}
  foodReviews: [],   // {id, userId, username, itemName, park, score, review, ts}
  photos: [],        // {id, userId, username, avatar, park, caption, dataUrl, ts}
  nextId: 1,
};

// Seed demo data
(function seedDemo() {
  const demoUsers = [
    {id:'u1',username:'jess_rides',fname:'Jess',lname:'R',email:'jess@demo.com',password:'demo',avatar:'🎢',bio:'All 7 parks, all the time.',location:'Orlando, FL',parks:[],joinYear:2019},
    {id:'u2',username:'mkfanatic',fname:'Mike',lname:'K',email:'mike@demo.com',password:'demo',avatar:'🏰',bio:'Magic Kingdom is life.',location:'Kissimmee, FL',parks:[],joinYear:2020},
    {id:'u3',username:'pixiedust99',fname:'Paula',lname:'P',email:'paula@demo.com',password:'demo',avatar:'🌍',bio:'EPCOT food & wine every year!',location:'Tampa, FL',parks:[],joinYear:2018},
    {id:'u4',username:'adventurefam',fname:'Adam',lname:'F',email:'adam@demo.com',password:'demo',avatar:'🦁',bio:'Family of 4, annual passholders since 2021.',location:'St. Pete, FL',parks:[],joinYear:2021},
    {id:'u5',username:'butterbeer_lord',fname:'Ben',lname:'L',email:'ben@demo.com',password:'demo',avatar:'⚓',bio:'IoA is my second home.',location:'Lakeland, FL',parks:[],joinYear:2022},
  ];
  STATE.users = demoUsers;

  const parks=['Magic Kingdom','EPCOT','Hollywood Studios','Animal Kingdom','Universal Studios Florida','Islands of Adventure'];
  const foods=[['Dole Whip Float','Mickey Pretzel'],['School Bread','Bratwurst'],['Ronto Wrap','Blue Milk'],['Satu\'li Bowl','Pongu Lumpia'],['Butterbeer','Three Broomsticks Feast']];
  let id=1;
  demoUsers.forEach((u,ui) => {
    const count = [143,118,97,84,62][ui];
    for(let i=0;i<count;i++) {
      STATE.checkins.push({
        id:'c'+id++,userId:u.id,
        park:parks[i%parks.length],
        date:'2026-0'+(Math.min(9,1+Math.floor(i/20)))+'-01',
        miles:(4+Math.random()*6).toFixed(1)*1,
        foods:foods[ui],
        score:(7+Math.random()*3).toFixed(1)*1,
        review:'Great day!', photo:null,
        ts: Date.now() - (count-i)*86400000
      });
    }
  });

  const foodItems=[
    {itemName:'Dole Whip Float',park:'Magic Kingdom',baseScore:9.4,reviews:1247},
    {itemName:'School Bread',park:'EPCOT',baseScore:9.1,reviews:892},
    {itemName:'Butterbeer (cold)',park:'Islands of Adventure',baseScore:9.0,reviews:2108},
    {itemName:'Churro',park:'Magic Kingdom',baseScore:8.7,reviews:3412},
    {itemName:'Tonga Toast',park:'Magic Kingdom',baseScore:8.5,reviews:564},
    {itemName:'Ronto Wrap',park:'Hollywood Studios',baseScore:8.4,reviews:1091},
    {itemName:'Edamame Dumplings',park:'Animal Kingdom',baseScore:8.2,reviews:437},
    {itemName:'Via Napoli Margherita',park:'EPCOT',baseScore:8.1,reviews:723},
  ];
  foodItems.forEach((fi,i) => {
    STATE.foodReviews.push({
      id:'fr'+i, userId:'u1', username:'community',
      itemName:fi.itemName, park:fi.park,
      score:fi.baseScore, review:'Community average',
      ts: Date.now()-i*3600000,
      _reviewCount: fi.reviews,
    });
  });

  const photoPark=['Magic Kingdom','EPCOT','Hollywood Studios','Animal Kingdom','Islands of Adventure'];
  const photoCaption=['Golden hour at the castle!','World Showcase magic','Star Wars vibes all day','Lions out at sunrise','Hogwarts in the rain'];
  for(let i=0;i<5;i++) {
    STATE.photos.push({
      id:'ph'+i, userId:demoUsers[i].id, username:demoUsers[i].username,
      avatar:demoUsers[i].avatar, park:photoPark[i],
      caption:photoCaption[i], dataUrl:null, ts:Date.now()-i*7200000
    });
  }
  STATE.nextId = id;
})();

// ============================================================
// UTILITY
// ============================================================
function toast(msg, type='success') {
  const t = document.getElementById('toast');
  const ic = document.getElementById('toast-icon');
  const m = document.getElementById('toast-msg');
  t.className = 'toast ' + type;
  ic.className = type==='success' ? 'ti ti-circle-check' : type==='error' ? 'ti ti-alert-circle' : 'ti ti-info-circle';
  m.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

function openOverlay(id) {
  document.querySelectorAll('.overlay.open').forEach(o => o.classList.remove('open'));
  document.getElementById(id).classList.add('open');
}
function closeOverlay(id) {
  document.getElementById(id).classList.remove('open');
  resetTicket();
}
document.querySelectorAll('.overlay').forEach(o => {
  o.addEventListener('click', e => { if(e.target===o){ o.classList.remove('open'); resetTicket(); } });
});

// Tear the hero ticket's stub off, then open the auth modal
function ripTicket(which) {
  const overlay = which === 'signin' ? 'overlay-signin' : 'overlay-register';
  const t = document.querySelector('.ticket-hero .ticket');
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(!t || reduce || t.classList.contains('ripping')) { openOverlay(overlay); return; }
  t.classList.add('ripping');
  setTimeout(() => openOverlay(overlay), 620);
}
function resetTicket() {
  const t = document.querySelector('.ticket-hero .ticket');
  if(t) t.classList.remove('ripping');
}

function showView(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById('view-'+name).classList.add('active');
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
  const navEl = document.getElementById('nav-'+name);
  if(navEl) navEl.classList.add('active');
  if(name==='community') renderCommunity();
  if(name==='food') renderFood();
  if(name==='photos') renderPhotos();
  if(name==='profile') renderProfile();
  window.scrollTo(0,0);
}

// ============================================================
// AUTH
// ============================================================
let regStep = 1;
let selectedAvatar = '🎢';

function openSignIn() { openOverlay('overlay-signin'); }

function switchToRegister() {
  closeOverlay('overlay-signin');
  openOverlay('overlay-register');
}

function doSignIn() {
  const u = document.getElementById('signin-user').value.trim();
  const p = document.getElementById('signin-pass').value;
  const found = STATE.users.find(x => (x.username===u||x.email===u) && x.password===p);
  const err = document.getElementById('signin-err');
  if(!found) { err.classList.add('show'); return; }
  err.classList.remove('show');
  closeOverlay('overlay-signin');
  loginAs(found);
}

function loginAs(user) {
  STATE.currentUser = user;
  document.getElementById('nav-avatar').textContent = user.avatar;
  document.getElementById('nav-username').textContent = user.username;
  document.getElementById('landing-shell').style.display = 'none';
  document.getElementById('app-shell').style.display = 'block';
  updatePassport();
  updateParkCounts();
  renderRecentActivity();
  showView('home');
  toast('Welcome back, ' + user.fname + '! 🎢');
}

function doSignOut() {
  STATE.currentUser = null;
  document.getElementById('app-shell').style.display = 'none';
  document.getElementById('landing-shell').style.display = 'block';
  closeDropdown();
  toast('Signed out. See you next visit!', 'info');
}

// Registration flow
function pickAvatar(el) {
  document.querySelectorAll('.avatar-opt').forEach(a => a.classList.remove('selected'));
  el.classList.add('selected');
  selectedAvatar = el.dataset.emoji;
}

function regNext() {
  const err = document.getElementById('reg-user-err');
  const perr = document.getElementById('reg-pass-err');
  err.classList.remove('show'); perr.classList.remove('show');

  if(regStep===1) {
    const fname = document.getElementById('reg-fname').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const pass = document.getElementById('reg-pass').value;
    const pass2 = document.getElementById('reg-pass2').value;
    if(!fname||!username||!email||!pass) { toast('Please fill in all required fields.','error'); return; }
    if(STATE.users.find(u=>u.username===username)) { err.classList.add('show'); return; }
    if(pass!==pass2) { perr.classList.add('show'); return; }
    regStep=2;
    document.getElementById('reg-page-1').style.display='none';
    document.getElementById('reg-page-2').style.display='block';
    document.getElementById('reg-step-1').className='step-item done';
    document.getElementById('reg-step-2').className='step-item active';
    document.getElementById('reg-back-btn').style.display='block';
  } else if(regStep===2) {
    regStep=3;
    document.getElementById('reg-page-2').style.display='none';
    document.getElementById('reg-page-3').style.display='block';
    document.getElementById('reg-step-2').className='step-item done';
    document.getElementById('reg-step-3').className='step-item active';
    document.getElementById('reg-next-btn').textContent='Create Account ✓';
  } else if(regStep===3) {
    const fname = document.getElementById('reg-fname').value.trim();
    const lname = document.getElementById('reg-lname').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const pass = document.getElementById('reg-pass').value;
    const bio = document.getElementById('reg-bio').value.trim();
    const loc = document.getElementById('reg-location').value.trim();
    const parks = [...document.querySelectorAll('#park-picker input:checked')].map(c=>c.value);
    const newUser = {
      id: 'u'+STATE.nextId++,
      username, fname, lname, email, password: pass,
      avatar: selectedAvatar, bio: bio||'Theme park enthusiast.', location: loc,
      parks, joinYear: new Date().getFullYear()
    };
    STATE.users.push(newUser);
    closeOverlay('overlay-register');
    resetRegForm();
    loginAs(newUser);
    toast('Account created! Welcome to Turnstiles, ' + fname + '! 🎟️');
  }
}

function regBack() {
  if(regStep===2) {
    regStep=1;
    document.getElementById('reg-page-2').style.display='none';
    document.getElementById('reg-page-1').style.display='block';
    document.getElementById('reg-step-1').className='step-item active';
    document.getElementById('reg-step-2').className='step-item';
    document.getElementById('reg-back-btn').style.display='none';
  } else if(regStep===3) {
    regStep=2;
    document.getElementById('reg-page-3').style.display='none';
    document.getElementById('reg-page-2').style.display='block';
    document.getElementById('reg-step-2').className='step-item active';
    document.getElementById('reg-step-3').className='step-item';
    document.getElementById('reg-next-btn').textContent='Next →';
  }
}

function resetRegForm() {
  regStep=1;
  ['reg-fname','reg-lname','reg-username','reg-email','reg-pass','reg-pass2','reg-bio','reg-location'].forEach(id=>{document.getElementById(id).value=''});
  document.getElementById('reg-page-1').style.display='block';
  document.getElementById('reg-page-2').style.display='none';
  document.getElementById('reg-page-3').style.display='none';
  document.getElementById('reg-step-1').className='step-item active';
  document.getElementById('reg-step-2').className='step-item';
  document.getElementById('reg-step-3').className='step-item';
  document.getElementById('reg-back-btn').style.display='none';
  document.getElementById('reg-next-btn').textContent='Next →';
  selectedAvatar='🎢';
}

// ============================================================
// DROPDOWN
// ============================================================
function toggleDropdown() {
  document.getElementById('user-dropdown').classList.toggle('open');
}
function closeDropdown() {
  document.getElementById('user-dropdown').classList.remove('open');
}
document.addEventListener('click', e => {
  if(!e.target.closest('#nav-user-pill') && !e.target.closest('#user-dropdown')) closeDropdown();
});

// ============================================================
// CHECK-IN
// ============================================================
function updateScoreDisplay(val) {
  document.getElementById('ci-score-display').textContent = parseFloat(val).toFixed(1) + ' / 10';
}

function foodKeydown(e) { if(e.key==='Enter') addFoodTag(); }

function addFoodTag() {
  const inp = document.getElementById('ci-food-input');
  const val = inp.value.trim();
  if(!val) return;
  const list = document.getElementById('ci-food-tags');
  const tag = document.createElement('span');
  tag.className = 'food-tag-item';
  tag.innerHTML = '🍽️ '+val+' <button class="food-tag-remove" onclick="this.parentElement.remove()">✕</button>';
  list.appendChild(tag);
  inp.value='';
}

function triggerPhotoUpload() {
  document.getElementById('ci-photo-input').click();
}

function handlePhotoSelect(e) {
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = r => {
    document.getElementById('ci-photo-preview').style.display='block';
    document.getElementById('ci-photo-img').src = r.target.result;
  };
  reader.readAsDataURL(file);
}

function handleCommunityPhoto(e) {
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = r => {
    document.getElementById('ph-preview').style.display='block';
    document.getElementById('ph-preview-img').src = r.target.result;
  };
  reader.readAsDataURL(file);
}

function quickCheckin(park) {
  document.getElementById('ci-park').value = park;
  document.getElementById('ci-date').valueAsDate = new Date();
  openOverlay('overlay-checkin');
}

function submitCheckin() {
  if(!STATE.currentUser) { toast('Please sign in first.','error'); return; }
  const park = document.getElementById('ci-park').value;
  const date = document.getElementById('ci-date').value || new Date().toISOString().split('T')[0];
  const miles = parseFloat(document.getElementById('ci-miles').value)||0;
  const score = parseFloat(document.getElementById('ci-score').value)||8.5;
  const review = document.getElementById('ci-review').value.trim();
  const foods = [...document.querySelectorAll('#ci-food-tags .food-tag-item')].map(t=>t.textContent.replace('✕','').replace('🍽️','').trim());
  const photoImg = document.getElementById('ci-photo-img');
  const photo = photoImg.src && photoImg.src!==window.location.href ? photoImg.src : null;

  const checkin = {
    id: 'c'+STATE.nextId++,
    userId: STATE.currentUser.id,
    park, date, miles, foods, score, review, photo,
    ts: Date.now()
  };
  STATE.checkins.unshift(checkin);

  // Add food reviews automatically
  foods.forEach(f => {
    if(f) STATE.foodReviews.unshift({
      id:'fr'+STATE.nextId++, userId:STATE.currentUser.id,
      username:STATE.currentUser.username, itemName:f, park, score, review,
      ts:Date.now(), _reviewCount:1
    });
  });

  // Add photo to community
  if(photo) {
    STATE.photos.unshift({
      id:'ph'+STATE.nextId++, userId:STATE.currentUser.id,
      username:STATE.currentUser.username, avatar:STATE.currentUser.avatar,
      park, caption:review||'Check-in at '+park, dataUrl:photo, ts:Date.now()
    });
  }

  closeOverlay('overlay-checkin');
  // Reset form
  document.getElementById('ci-miles').value='';
  document.getElementById('ci-food-tags').innerHTML='';
  document.getElementById('ci-review').value='';
  document.getElementById('ci-score').value=8.5;
  document.getElementById('ci-score-display').textContent='8.5 / 10';
  document.getElementById('ci-photo-preview').style.display='none';
  document.getElementById('ci-photo-input').value='';
  document.getElementById('ci-date').valueAsDate = new Date();

  updatePassport();
  updateParkCounts();
  renderRecentActivity();
  toast('Check-in at ' + park + ' logged! 🎟️');
}

// ============================================================
// FOOD REVIEW
// ============================================================
function submitFoodReview() {
  if(!STATE.currentUser) { toast('Please sign in first.','error'); return; }
  const name = document.getElementById('fr-name').value.trim();
  if(!name) { toast('Please enter a food item name.','error'); return; }
  const park = document.getElementById('fr-park').value;
  const score = parseFloat(document.getElementById('fr-score').value);
  const review = document.getElementById('fr-review').value.trim();
  STATE.foodReviews.unshift({
    id:'fr'+STATE.nextId++, userId:STATE.currentUser.id,
    username:STATE.currentUser.username, itemName:name, park, score, review,
    ts:Date.now(), _reviewCount:1
  });
  closeOverlay('overlay-food-review');
  document.getElementById('fr-name').value='';
  document.getElementById('fr-review').value='';
  renderFood();
  toast(name + ' rated ' + score.toFixed(1) + '/10! ⭐');
}

// ============================================================
// PHOTO SUBMIT
// ============================================================
function submitPhoto() {
  if(!STATE.currentUser) { toast('Please sign in first.','error'); return; }
  const park = document.getElementById('ph-park').value;
  const caption = document.getElementById('ph-caption').value.trim();
  const img = document.getElementById('ph-preview-img');
  const dataUrl = img.src && img.src!==window.location.href ? img.src : null;
  STATE.photos.unshift({
    id:'ph'+STATE.nextId++, userId:STATE.currentUser.id,
    username:STATE.currentUser.username, avatar:STATE.currentUser.avatar,
    park, caption:caption||'At '+park, dataUrl, ts:Date.now()
  });
  closeOverlay('overlay-photo');
  document.getElementById('ph-caption').value='';
  document.getElementById('ph-preview').style.display='none';
  document.getElementById('ph-file').value='';
  renderPhotos();
  toast('Photo shared with the community! 📸');
}

// ============================================================
// PASSPORT & STATS UPDATE
// ============================================================
const PARK_COLORS = {
  'Magic Kingdom':'#1B6FC4','EPCOT':'#1DA09A',
  'Hollywood Studios':'#3A7CBF','Animal Kingdom':'#2E9E6A',
  'Universal Studios Florida':'#1565A8','Islands of Adventure':'#2E9E6A',
  'Epic Universe':'#5B4FBF','Blizzard Beach':'#1B6FC4',
  'Typhoon Lagoon':'#1DA09A','Volcano Bay':'#C94B28'
};

function userCheckins(userId) {
  return STATE.checkins.filter(c => c.userId === (userId||STATE.currentUser?.id));
}

function getTier(visits) {
  if(visits>=100) return {name:'Platinum',stars:'★★★★★'};
  if(visits>=50)  return {name:'Gold',    stars:'★★★★'};
  if(visits>=20)  return {name:'Silver',  stars:'★★★'};
  return                  {name:'Bronze', stars:'★'};
}

function updatePassport() {
  const u = STATE.currentUser; if(!u) return;
  const my = userCheckins();
  const total = my.length;
  const miles = my.reduce((s,c)=>s+(c.miles||0),0);
  const allFoods = [...new Set(my.flatMap(c=>c.foods||[]))];
  const scores = my.filter(c=>c.score).map(c=>c.score);
  const avgScore = scores.length ? (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1) : '—';

  // Leaderboard rank
  const lb = buildLeaderboard('all');
  const rank = lb.findIndex(r=>r.userId===u.id)+1 || '—';

  // Update hero stats
  document.getElementById('stat-visits').textContent = total;
  document.getElementById('stat-miles').textContent = miles.toFixed(1);
  document.getElementById('stat-foods').textContent = allFoods.length;
  document.getElementById('stat-rank').textContent = rank ? '#'+rank : '#—';

  // Passport card
  document.getElementById('passport-name').textContent = (u.fname+' '+u.lname[0]+'.').toUpperCase();
  document.getElementById('passport-avatar').textContent = u.avatar;
  const tier = getTier(total);
  document.getElementById('passport-tier').textContent = tier.name+' Tier';
  document.getElementById('passport-stars').textContent = tier.stars;
  document.getElementById('passport-rank').textContent = rank ? '#'+rank : '—';
  document.getElementById('pf-since').textContent = u.joinYear;
  document.getElementById('pf-avg-food').textContent = avgScore;
  document.getElementById('pf-photos').textContent = STATE.photos.filter(p=>p.userId===u.id).length;

  // Park bars
  const parkCounts = {};
  my.forEach(c => { parkCounts[c.park] = (parkCounts[c.park]||0)+1; });
  const topParks = Object.entries(parkCounts).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const maxCount = topParks[0]?.[1]||1;
  const barsEl = document.getElementById('passport-park-bars');
  if(topParks.length===0) {
    barsEl.innerHTML = '<div style="text-align:center;padding:16px 0;font-size:12px;color:var(--ink-faint);font-weight:300;letter-spacing:0.5px">No visits logged yet.<br>Hit "Log a Check-In" to get started!</div>';
  } else {
    barsEl.innerHTML = topParks.map(([park,count]) => {
      const color = PARK_COLORS[park]||'#1B6FC4';
      const pct = Math.round((count/maxCount)*100);
      return `<div class="park-bar-row">
        <div class="park-dot" style="background:${color}"></div>
        <span class="park-label">${park.replace('Universal Studios Florida','Univ. Studios').replace('Islands of Adventure','Islands of Adv.').replace('Hollywood Studios','Hollywood Stu.')}</span>
        <div class="park-bar-track"><div class="park-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <span class="park-count">${count}</span>
      </div>`;
    }).join('');
  }
}

function updateParkCounts() {
  const my = userCheckins();
  const parkCounts = {};
  my.forEach(c => { parkCounts[c.park] = (parkCounts[c.park]||0)+1; });
  document.querySelectorAll('[id^="pv-"]').forEach(el => {
    const park = el.id.replace('pv-','');
    const count = parkCounts[park]||0;
    const last = my.filter(c=>c.park===park).sort((a,b)=>b.ts-a.ts)[0];
    el.textContent = count + (count===1?' visit':' visits') + (last ? ' · Last: '+formatDate(last.date) : '');
  });
}

function formatDate(d) {
  if(!d) return '';
  const dt = new Date(d+'T12:00:00');
  return dt.toLocaleDateString('en-US',{month:'short',day:'numeric'});
}

// ============================================================
// RECENT ACTIVITY
// ============================================================
function renderRecentActivity() {
  const my = userCheckins().slice(0,6);
  const el = document.getElementById('recent-activity-list');
  if(!my.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🎢</div><div class="empty-state-title">No Check-Ins Yet</div><div class="empty-state-sub">Log your first visit using the Check In button above.</div></div>';
    return;
  }
  el.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px">' +
    my.map(c => `<div class="feed-card">
      <div class="feed-top">
        <div class="feed-av" style="background:var(--coral-lt);color:var(--coral)">${STATE.currentUser.avatar}</div>
        <div class="feed-meta">
          <div class="feed-username">${STATE.currentUser.username}</div>
          <div class="feed-parkname">${parkEmoji(c.park)} ${c.park} · Visit #${userCheckins().filter(x=>x.park===c.park).reverse().indexOf(c)+1}</div>
        </div>
        <div class="feed-time">${timeAgo(c.ts)}</div>
      </div>
      <div class="feed-pills">
        ${c.miles?'<span class="pill pill-walk"><i class="ti ti-shoe"></i> '+c.miles+' mi</span>':''}
        ${(c.foods||[]).slice(0,2).map(f=>'<span class="pill pill-food"><i class="ti ti-tools-kitchen-2"></i> '+f+'</span>').join('')}
        ${c.score?'<span class="pill pill-score"><i class="ti ti-star"></i> '+c.score.toFixed(1)+' / 10</span>':''}
        ${c.photo?'<span class="pill pill-photo"><i class="ti ti-camera"></i> Photo</span>':''}
      </div>
    </div>`).join('') + '</div>';
}

// ============================================================
// COMMUNITY VIEW
// ============================================================
function buildLeaderboard(filter) {
  const filterParks = {
    disney: ['Magic Kingdom','EPCOT','Hollywood Studios','Animal Kingdom'],
    universal: ['Universal Studios Florida','Islands of Adventure','Epic Universe'],
    water: ['Blizzard Beach','Typhoon Lagoon','Volcano Bay'],
    all: null
  }[filter]||null;

  return STATE.users.map(u => {
    const mine = STATE.checkins.filter(c => {
      if(c.userId!==u.id) return false;
      if(filterParks && !filterParks.includes(c.park)) return false;
      return true;
    });
    return {userId:u.id, username:u.username, avatar:u.avatar,
             fname:u.fname, visits:mine.length,
             tier:getTier(STATE.checkins.filter(c=>c.userId===u.id).length).name};
  }).sort((a,b)=>b.visits-a.visits);
}

let lbFilter = 'all';
function switchLbFilter(f, btn) {
  lbFilter=f;
  document.querySelectorAll('[id^="lb-btn-"]').forEach(b=>{b.className='btn-sm';});
  btn.className='btn-sm primary';
  renderLeaderboard();
}

function renderLeaderboard() {
  const lb = buildLeaderboard(lbFilter);
  const el = document.getElementById('leaderboard-list');
  const u = STATE.currentUser;
  const rankColors = ['gold','silver','bronze'];
  el.innerHTML = lb.map((row,i) => {
    const isYou = u && row.userId===u.id;
    const tierColor = {Platinum:'var(--gold)',Gold:'var(--gold)',Silver:'#888',Bronze:'var(--coral)'};
    return `<div class="lb-row${isYou?' you':''}">
      <span class="lb-rank ${rankColors[i]||''}">${i+1}</span>
      <div class="lb-av" style="background:var(--coral-lt);color:var(--coral)">${row.avatar}</div>
      <div class="lb-info">
        <div class="lb-username">${row.username}${isYou?'<span class="you-tag">YOU</span>':''}</div>
        <div class="lb-detail">${row.tier} Tier</div>
      </div>
      <div class="lb-visits-wrap">
        <div class="lb-visits" style="${isYou?'color:var(--coral)':''}">${row.visits}</div>
        <div class="lb-visits-lbl">visits</div>
      </div>
    </div>`;
  }).join('') || '<div class="empty-state"><div class="empty-state-sub">No data yet.</div></div>';
}

function renderCommunityFeed() {
  const items = [...STATE.checkins].sort((a,b)=>b.ts-a.ts).slice(0,20);
  const el = document.getElementById('community-feed-list');
  if(!items.length) {
    el.innerHTML='<div class="empty-state"><div class="empty-state-icon">📡</div><div class="empty-state-title">No Activity Yet</div><div class="empty-state-sub">Check-ins from the community will appear here.</div></div>';
    return;
  }
  el.innerHTML = '<div style="display:flex;flex-direction:column;gap:10px">' +
    items.map(c => {
      const user = STATE.users.find(u=>u.id===c.userId);
      if(!user) return '';
      return `<div class="feed-card">
        <div class="feed-top">
          <div class="feed-av" style="background:var(--coral-lt);color:var(--coral)">${user.avatar}</div>
          <div class="feed-meta">
            <div class="feed-username">${user.username}</div>
            <div class="feed-parkname">${parkEmoji(c.park)} ${c.park}</div>
          </div>
          <div class="feed-time">${timeAgo(c.ts)}</div>
        </div>
        <div class="feed-pills">
          ${c.miles?'<span class="pill pill-walk"><i class="ti ti-shoe"></i> '+c.miles+' mi</span>':''}
          ${(c.foods||[]).slice(0,2).map(f=>'<span class="pill pill-food"><i class="ti ti-tools-kitchen-2"></i> '+f+'</span>').join('')}
          ${c.score?'<span class="pill pill-score"><i class="ti ti-star"></i> '+c.score.toFixed(1)+'/10</span>':''}
        </div>
      </div>`;
    }).join('') + '</div>';
}

function renderCommunity() {
  renderLeaderboard();
  renderCommunityFeed();
}

let communityTab = 'leaderboard';
function switchCommunityTab(btn, tab) {
  communityTab=tab;
  document.querySelectorAll('#view-community .page-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('ctab-leaderboard').style.display = tab==='leaderboard'?'block':'none';
  document.getElementById('ctab-feed').style.display = tab==='feed'?'block':'none';
}

// ============================================================
// FOOD SCORES
// ============================================================
function getFoodAggregates() {
  const map = {};
  STATE.foodReviews.forEach(r => {
    const key = r.itemName.toLowerCase()+'|'+r.park;
    if(!map[key]) map[key] = {itemName:r.itemName, park:r.park, scores:[], count:r._reviewCount||1};
    else if(r._reviewCount) map[key].count += r._reviewCount;
    map[key].scores.push(r.score);
  });
  return Object.values(map).map(m => {
    const avg = m.scores.reduce((a,b)=>a+b,0)/m.scores.length;
    return {...m, avgScore: Math.round(avg*10)/10};
  }).sort((a,b)=>b.avgScore-a.avgScore);
}

const FOOD_EMOJI = {
  'Dole Whip Float':'🍍','School Bread':'🍞','Butterbeer (cold)':'🍺',
  'Churro':'🥐','Tonga Toast':'🍞','Ronto Wrap':'🌯',
  'Edamame Dumplings':'🫛','Via Napoli Margherita':'🍕'
};
function foodEmoji(name) { return FOOD_EMOJI[name]||'🍽️'; }

function renderFood() {
  const agg = getFoodAggregates();
  const byScore = [...agg].sort((a,b)=>b.avgScore-a.avgScore).slice(0,10);
  const byPop = [...agg].sort((a,b)=>b.count-a.count).slice(0,10);

  const renderList = (items, el) => {
    if(!items.length) { el.innerHTML='<div class="empty-state"><div class="empty-state-sub">No food reviews yet.<br>Log a check-in to add items!</div></div>'; return; }
    el.innerHTML = items.map((item,i) => `
      <div class="food-item">
        <div class="food-rank">${i+1}</div>
        <div class="food-emoji">${foodEmoji(item.itemName)}</div>
        <div class="food-info">
          <div class="food-name">${item.itemName}</div>
          <div class="food-loc">${item.park}</div>
        </div>
        <div class="food-score-block">
          <div class="food-score-num">${item.avgScore.toFixed(1)}</div>
          <div class="food-rev-count">${item.count.toLocaleString()} reviews</div>
        </div>
      </div>`).join('');
  };
  renderList(byScore, document.getElementById('food-scores-list'));
  renderList(byPop, document.getElementById('food-popular-list'));
}

// ============================================================
// PHOTOS
// ============================================================
const PHOTO_BG = ['#D0E8F5','#D0EFE1','#D4E7F7','#DCF4F3','#D0EFE1','#D0E8F5','#D4E7F7','#DCF4F3'];

function renderPhotos() {
  const el = document.getElementById('photos-grid');
  const photos = [...STATE.photos].sort((a,b)=>b.ts-a.ts);
  if(!photos.length) {
    el.innerHTML='<div style="grid-column:1/-1"><div class="empty-state"><div class="empty-state-icon">📸</div><div class="empty-state-title">No Photos Yet</div><div class="empty-state-sub">Be the first to share a photo from the parks!</div></div></div>';
    return;
  }
  el.innerHTML = photos.map((p,i) => `
    <div class="photo-thumb" style="background:${p.dataUrl?'#000':PHOTO_BG[i%PHOTO_BG.length]};border:1px solid var(--border)">
      ${p.dataUrl ? '<img src="'+p.dataUrl+'" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">' : '<span style="font-size:32px">'+parkEmoji(p.park)+'</span>'}
      <div class="photo-overlay">
        <span class="photo-user">${p.avatar} ${p.username}</span>
        <span class="photo-score" title="${p.caption||p.park}">${p.park.split(' ')[0]}</span>
      </div>
    </div>
  `).join('') + `
    <div class="photo-thumb" style="background:var(--parchment);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;cursor:pointer;border:2px dashed var(--border-md)" onclick="openOverlay('overlay-photo')">
      <i class="ti ti-camera-plus" style="font-size:24px;color:var(--ink-faint)"></i>
      <span style="font-size:9px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--ink-faint)">Share a photo</span>
    </div>`;
}

// ============================================================
// PROFILE VIEW
// ============================================================
function renderProfile() {
  const u = STATE.currentUser; if(!u) return;
  const my = userCheckins();
  const miles = my.reduce((s,c)=>s+(c.miles||0),0);
  const foods = [...new Set(my.flatMap(c=>c.foods||[]))];
  const scores = my.filter(c=>c.score).map(c=>c.score);
  const avg = scores.length ? (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1) : '—';
  const tier = getTier(my.length);

  document.getElementById('profile-avatar-big').textContent = u.avatar;
  document.getElementById('profile-display-name').textContent = u.fname + ' ' + u.lname;
  document.getElementById('profile-username').textContent = '@'+u.username;
  document.getElementById('profile-bio').textContent = u.bio||'No bio yet.';
  document.getElementById('prof-stat-visits').textContent = my.length;
  document.getElementById('prof-stat-miles').textContent = miles.toFixed(1);
  document.getElementById('prof-stat-foods').textContent = foods.length;
  document.getElementById('prof-stat-avg').textContent = avg;

  const badges = [`${tier.name} Tier`];
  if(my.length>=1) badges.push('First Visit');
  if(my.length>=10) badges.push('Regular');
  if(my.length>=50) badges.push('Gold Passholder');
  if([...new Set(my.map(c=>c.park))].length>=4) badges.push('Park Hopper');
  if(foods.length>=10) badges.push('Foodie');
  document.getElementById('profile-badges').innerHTML = badges.map(b =>
    `<span class="badge${b.includes('Gold')||b.includes('Park')||b.includes('Foodie')?' gold':''}">${b}</span>`
  ).join('');

  // Visit history table
  const histEl = document.getElementById('visit-history-table');
  if(!my.length) {
    histEl.innerHTML='<div class="empty-state"><div class="empty-state-icon">🎟️</div><div class="empty-state-title">No Visits Yet</div><div class="empty-state-sub">Your logged check-ins will appear here.</div></div>';
    return;
  }
  histEl.innerHTML = `<table class="visit-table">
    <thead><tr>
      <th>Park</th><th>Date</th><th>Miles</th><th>Food Score</th><th>Foods Tried</th>
    </tr></thead>
    <tbody>
      ${my.slice(0,20).map(c=>`<tr>
        <td>${parkEmoji(c.park)} ${c.park}</td>
        <td>${formatDate(c.date)}</td>
        <td>${c.miles?c.miles+' mi':'—'}</td>
        <td>${c.score?'<span class="visit-tag">'+c.score.toFixed(1)+'/10</span>':'—'}</td>
        <td style="font-size:12px;color:var(--ink-faint)">${(c.foods||[]).join(', ')||'—'}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

function openEditProfile() {
  // Quick inline edit via prompts (would be a proper modal in production)
  const u = STATE.currentUser;
  const bio = prompt('Update your bio:', u.bio||'');
  if(bio!==null) { u.bio=bio; renderProfile(); updatePassport(); toast('Bio updated!'); }
}

// ============================================================
// PARK TAB SWITCHER
// ============================================================
function switchParkTab(btn, tab) {
  document.querySelectorAll('.tabs .tab').forEach(t=>{t.classList.remove('active');});
  btn.classList.add('active');
  ['disney','universal','water'].forEach(id=>{
    const p=document.getElementById('ptab-'+id);
    if(p) p.style.display = id===tab?'block':'none';
  });
}

// ============================================================
// HELPERS
// ============================================================
function parkEmoji(park) {
  const map={'Magic Kingdom':'🏰','EPCOT':'🌍','Hollywood Studios':'🎬','Animal Kingdom':'🦁',
    'Universal Studios Florida':'🎥','Islands of Adventure':'⚓','Epic Universe':'🌌',
    'Blizzard Beach':'⛷️','Typhoon Lagoon':'🌊','Volcano Bay':'🌋'};
  return map[park]||'🎡';
}

function timeAgo(ts) {
  const diff = Date.now()-ts;
  if(diff<60000) return 'Just now';
  if(diff<3600000) return Math.floor(diff/60000)+'m ago';
  if(diff<86400000) return Math.floor(diff/3600000)+'h ago';
  return Math.floor(diff/86400000)+'d ago';
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Always start on landing (user must sign in)
  document.getElementById('landing-shell').style.display = 'block';
  document.getElementById('app-shell').style.display = 'none';

  // Set today's date in check-in form
  document.getElementById('ci-date').valueAsDate = new Date();
});