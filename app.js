/* ── Background Canvas Animation ── */
(function () {
  const canvas = document.getElementById('bg-canvas');
  const ctx = canvas.getContext('2d');
  let W, H;

  const COLORS = [
    [0, 212, 255],    // cyan
    [160, 60, 255],   // purple
    [255, 60, 180],   // pink
  ];

  // Seeded pseudo-random so orbs are stable on init
  function seededRand(seed) {
    const x = Math.sin(seed + 1) * 43758.5453123;
    return x - Math.floor(x);
  }

  const ORB_COUNT = 20;
  let orbs = [];

  function initOrbs() {
    orbs = Array.from({ length: ORB_COUNT }, (_, i) => ({
      x: (i % 4) / 4 * W + seededRand(i * 7) * (W / 4),   // grid-spread + jitter
      y: Math.floor(i / 4) / 5 * H + seededRand(i * 7 + 1) * (H / 5),
      r: 60 + seededRand(i * 7 + 2) * 80,
      vx: (seededRand(i * 7 + 3) - 0.5) * 0.38,
      vy: (seededRand(i * 7 + 4) - 0.5) * 0.38,
      phase: seededRand(i * 7 + 5) * Math.PI * 2,
      speed: 0.0003 + seededRand(i * 7 + 6) * 0.0004,
      color: COLORS[i % COLORS.length],
    }));
  }

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    initOrbs();
  }

  function draw(ts) {
    ctx.clearRect(0, 0, W, H);

    for (const orb of orbs) {
      // Drift position
      orb.x += orb.vx;
      orb.y += orb.vy;

      // Soft bounce off edges so orbs stay on screen
      if (orb.x < -orb.r) orb.x = W + orb.r;
      else if (orb.x > W + orb.r) orb.x = -orb.r;
      if (orb.y < -orb.r) orb.y = H + orb.r;
      else if (orb.y > H + orb.r) orb.y = -orb.r;

      // Breathing alpha
      const breath = (Math.sin(orb.phase + ts * orb.speed) + 1) / 2;
      const alpha = 0.18 + breath * 0.22;

      const [r, g, b] = orb.color;
      const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(draw);
})();


/* ── Spotify ── */
const SPOTIFY_CLIENT_ID = '866ab5a708b044e89ae4c28c2fe4081c';
const SPOTIFY_REDIRECT_URI = 'https://sjswish84-dev.github.io/swish84-main/';

let spotifyToken = null;
let selectedTrack = null; // track attached to the currently open add/edit form
let _savedAddTrack = null; // preserved while an edit is open
let _searchResults = [];
let _searchTimer = null;
let _audio = null;
let _playBtn = null;

/* PKCE helpers */
function _b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function _makeVerifier() {
  const a = new Uint8Array(56);
  crypto.getRandomValues(a);
  return _b64url(a);
}
async function _makeChallenge(v) {
  return _b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v)));
}

async function loginSpotify() {
  if (!SPOTIFY_CLIENT_ID || SPOTIFY_CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
    alert('Paste your Spotify Client ID into app.js first (see developer.spotify.com/dashboard).');
    return;
  }
  const v = _makeVerifier();
  localStorage.setItem('sp_v', v);
  const c = await _makeChallenge(v);
  location.href = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: SPOTIFY_REDIRECT_URI,
    scope: 'user-read-private',
    code_challenge_method: 'S256',
    code_challenge: c,
  });
}

async function _exchangeCode(code) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: SPOTIFY_REDIRECT_URI,
      client_id: SPOTIFY_CLIENT_ID,
      code_verifier: localStorage.getItem('sp_v'),
    }),
  });
  const d = await res.json();
  if (d.access_token) {
    spotifyToken = d.access_token;
    localStorage.setItem('sp_token', spotifyToken);
    localStorage.setItem('sp_exp', Date.now() + d.expires_in * 1000);
    localStorage.removeItem('sp_v');
  }
  history.replaceState({}, '', location.pathname);
}

function _updateSpotifyBtn() {
  const btn = document.getElementById('spotify-connect-btn');
  const area = document.getElementById('track-search-area');
  if (!btn) return;
  if (spotifyToken) {
    btn.innerHTML = _spIcon(14) + ' Connected';
    btn.classList.add('connected');
    if (area) area.style.display = 'flex';
  } else {
    btn.innerHTML = _spIcon(14) + ' Connect Spotify';
    btn.classList.remove('connected');
    if (area) area.style.display = 'none';
  }
}

function initSpotify() {
  const token = localStorage.getItem('sp_token');
  const exp = parseInt(localStorage.getItem('sp_exp') || '0');
  if (token && Date.now() < exp) {
    spotifyToken = token;
    _updateSpotifyBtn();
    return;
  }
  const code = new URLSearchParams(location.search).get('code');
  if (code) _exchangeCode(code).then(_updateSpotifyBtn);
}

function onTrackSearch(e, ctx) {
  clearTimeout(_searchTimer);
  const q = e.target.value.trim();
  if (!q) { document.getElementById(ctx + '-track-dropdown').style.display = 'none'; return; }
  _searchTimer = setTimeout(async () => {
    const res = await fetch(
      'https://api.spotify.com/v1/search?q=' + encodeURIComponent(q) + '&type=track&limit=6',
      { headers: { Authorization: 'Bearer ' + spotifyToken } }
    );
    if (res.status === 401) {
      localStorage.removeItem('sp_token'); spotifyToken = null; _updateSpotifyBtn(); return;
    }
    _searchResults = (await res.json()).tracks?.items || [];
    _renderDropdown(ctx);
  }, 380);
}

function _renderDropdown(ctx) {
  const dd = document.getElementById(ctx + '-track-dropdown');
  if (!_searchResults.length) { dd.style.display = 'none'; return; }
  dd.innerHTML = _searchResults.map((t, i) => {
    const art = t.album.images[2]?.url || t.album.images[0]?.url || '';
    return '<div class="track-option" data-idx="' + i + '">'
      + (art ? '<img src="' + esc(art) + '" width="36" height="36">' : '<div class="no-art"></div>')
      + '<div><div class="opt-name">' + esc(t.name) + '</div>'
      + '<div class="opt-artist">' + esc(t.artists[0].name) + '</div></div></div>';
  }).join('');
  dd.querySelectorAll('.track-option').forEach(el => {
    el.addEventListener('click', () => selectTrack(_searchResults[+el.dataset.idx], ctx));
  });
  dd.style.display = 'block';
}

function selectTrack(t, ctx) {
  selectedTrack = {
    id: t.id,
    name: t.name,
    artist: t.artists[0].name,
    artistUrl: t.artists[0].external_urls.spotify,
    trackUrl: t.external_urls.spotify,
    albumArt: t.album.images[1]?.url || t.album.images[0]?.url || '',
    previewUrl: t.preview_url || null,
  };
  const inp = document.getElementById(ctx + '-track-search');
  if (inp) inp.value = '';
  document.getElementById(ctx + '-track-dropdown').style.display = 'none';
  _renderSelected(ctx);
}

function clearTrack(ctx) {
  selectedTrack = null;
  _renderSelected(ctx);
}

function _renderSelected(ctx) {
  const el = document.getElementById(ctx + '-selected-track');
  if (!el) return;
  if (!selectedTrack) { el.innerHTML = ''; return; }
  el.innerHTML = '<div class="selected-track-chip">'
    + (selectedTrack.albumArt ? '<img src="' + esc(selectedTrack.albumArt) + '" width="28" height="28">' : '')
    + '<span class="chip-text">' + esc(selectedTrack.name) + ' · <em>' + esc(selectedTrack.artist) + '</em></span>'
    + '<button class="btn-clear-track" onclick="clearTrack(\'' + ctx + '\')">×</button>'
    + '</div>';
}

function togglePlay(btn) {
  const url = btn.dataset.preview;
  if (_playBtn === btn) {
    if (_audio.paused) { _audio.play(); btn.innerHTML = _pauseIcon(); }
    else { _audio.pause(); btn.innerHTML = _playIcon(); }
    return;
  }
  if (_audio) _audio.pause();
  if (_playBtn) _playBtn.innerHTML = _playIcon();
  _audio = new Audio(url);
  _playBtn = btn;
  btn.innerHTML = _pauseIcon();
  _audio.play();
  _audio.onended = () => { btn.innerHTML = _playIcon(); _audio = null; _playBtn = null; };
}

function _playIcon() {
  return '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
}
function _pauseIcon() {
  return '<svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
}
function _spIcon(size) {
  return '<svg viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="currentColor" style="flex-shrink:0"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>';
}

function _trackHTML(track) {
  if (!track) return '';
  return '<iframe class="sp-embed" src="https://open.spotify.com/embed/track/' + esc(track.id) + '?utm_source=generator&theme=0" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>';
}

document.addEventListener('click', e => {
  if (!e.target.closest('.track-search-wrap')) {
    document.querySelectorAll('.track-dropdown').forEach(dd => dd.style.display = 'none');
  }
});

/* ── Supabase Client ── */
const { createClient } = supabase;
const db = createClient(
  'https://dfbjgoyaujlbwrptzoxs.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmYmpnb3lhdWpsYndycHR6b3hzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MDc0MDAsImV4cCI6MjA5ODE4MzQwMH0.wcs6Q5XgeW3PjUrU30y4yV1ljKofYgVgCc7dy-Fodak'
);

/* ── Auth ── */
const OWNER_EMAIL = 'sjswish84@gmail.com';
let currentUser = null;

function isOwner() {
  return !!currentUser && currentUser.email === OWNER_EMAIL;
}

function openLoginModal() {
  document.getElementById('login-email').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('login-modal').style.display = 'flex';
  document.getElementById('login-email').focus();
}

function closeLoginModal() {
  document.getElementById('login-modal').style.display = 'none';
}

async function submitLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');

  if (!email || !password) {
    errEl.textContent = 'Enter email and password.';
    errEl.style.display = 'block';
    return;
  }

  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    errEl.textContent = 'Sign in failed. Check your credentials.';
    errEl.style.display = 'block';
    return;
  }
  closeLoginModal();
}

async function logout() {
  await db.auth.signOut();
}

async function requestPasswordReset() {
  const email = document.getElementById('login-email').value.trim();
  const errEl = document.getElementById('login-error');

  if (!email) {
    errEl.textContent = 'Enter your email above first, then click "Forgot password?".';
    errEl.style.display = 'block';
    return;
  }

  const redirectTo = location.origin + location.pathname;
  const { error } = await db.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    errEl.textContent = 'Could not send reset email.';
    errEl.style.display = 'block';
    return;
  }
  closeLoginModal();
  alert('Check your email for a password reset link.');
}

function openResetPasswordModal() {
  document.getElementById('reset-password').value = '';
  document.getElementById('reset-error').style.display = 'none';
  document.getElementById('reset-password-modal').style.display = 'flex';
  document.getElementById('reset-password').focus();
}

async function submitNewPassword() {
  const password = document.getElementById('reset-password').value;
  const errEl = document.getElementById('reset-error');

  if (!password || password.length < 12) {
    errEl.textContent = 'Password must be at least 12 characters.';
    errEl.style.display = 'block';
    return;
  }

  const { error } = await db.auth.updateUser({ password });
  if (error) {
    errEl.textContent = 'Could not update password: ' + error.message;
    errEl.style.display = 'block';
    return;
  }
  document.getElementById('reset-password-modal').style.display = 'none';
  alert('Password updated — you are now signed in.');
}

function updateAuthUI() {
  const widget = document.getElementById('auth-widget');
  if (isOwner()) {
    widget.innerHTML = '<div class="auth-status"><span class="owner-email">' + esc(currentUser.email) + '</span>'
      + '<button class="btn-signout" onclick="openResetPasswordModal()">Change password</button>'
      + '<button class="btn-signout" onclick="logout()">Sign out</button></div>';
    document.body.classList.add('is-owner');
  } else {
    widget.innerHTML = '';
    document.body.classList.remove('is-owner');
  }
}

function checkLoginHash() {
  if (location.hash === '#login') {
    history.replaceState({}, '', location.pathname + location.search);
    openLoginModal();
  }
}
window.addEventListener('hashchange', checkLoginHash);

async function initAuth() {
  const { data: { session } } = await db.auth.getSession();
  currentUser = session?.user || null;
  updateAuthUI();
  renderEntries();
  checkLoginHash();

  db.auth.onAuthStateChange((event, session) => {
    currentUser = session?.user || null;
    updateAuthUI();
    renderEntries();
    if (event === 'PASSWORD_RECOVERY') {
      openResetPasswordModal();
    }
  });
}

/* ── TIL App ── */
let currentEntries = [];

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _formatDate(ts) {
  const d = new Date(ts);
  const date = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Los_Angeles' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Los_Angeles', timeZoneName: 'short' });
  return date + ' · ' + time;
}

async function renderEntries() {
  const list = document.getElementById('entry-list');
  list.innerHTML = '<p class="empty">Loading...</p>';

  const { data, error } = await db.from('entries').select('*').order('created_at', { ascending: false });

  if (error) {
    list.innerHTML = '<p class="empty">Error loading entries. Check your connection.</p>';
    return;
  }

  currentEntries = data || [];

  if (currentEntries.length === 0) {
    list.innerHTML = '<p class="empty">No entries yet — add your first one above!</p>';
    return;
  }

  list.innerHTML = currentEntries.map(e => `
    <div class="entry-card" id="card-${e.id}">
      <div class="entry-card-header">
        <div class="topic">
          <span class="topic-pill">${esc(e.topic)}</span>
        </div>
        ${isOwner() ? `
        <div class="card-actions">
          <button class="btn-edit" onclick="startEdit('${e.id}')">Edit</button>
          <button class="btn-delete" onclick="deleteEntry('${e.id}')">Delete</button>
        </div>
        ` : ''}
      </div>
      <div class="note">${esc(e.note)}</div>
      ${e.track ? _trackHTML(e.track) : ''}
      <div class="date">${_formatDate(e.created_at)}</div>
    </div>
  `).join('');
}

async function addEntry() {
  if (!isOwner()) return;
  const topic = document.getElementById('topic').value.trim();
  const note = document.getElementById('note').value.trim();

  if (!topic || !note) {
    alert('Please fill in both fields.');
    return;
  }

  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const { error } = await db.from('entries').insert([{ topic, note, date, track: selectedTrack }]);

  if (error) {
    alert('Error saving entry.');
    return;
  }

  document.getElementById('topic').value = '';
  document.getElementById('note').value = '';
  selectedTrack = null;
  _renderSelected('add');
  renderEntries();
}

async function deleteEntry(id) {
  if (!isOwner()) return;
  if (!confirm('Delete this entry?')) return;
  await db.from('entries').delete().eq('id', id);
  renderEntries();
}

function startEdit(id) {
  if (!isOwner()) return;
  const e = currentEntries.find(e => e.id === id);
  _savedAddTrack = selectedTrack;
  selectedTrack = e.track || null;
  const card = document.getElementById(`card-${id}`);

  card.innerHTML = `
    <div class="edit-form">
      <input type="text" id="edit-topic-${id}" value="${esc(e.topic)}" />
      <textarea id="edit-note-${id}">${esc(e.note)}</textarea>
      ${spotifyToken ? `
        <div class="track-search-wrap">
          <input id="edit-track-search" type="text" placeholder="♫  Change song…" oninput="onTrackSearch(event,'edit')" autocomplete="off" />
          <div id="edit-track-dropdown" class="track-dropdown"></div>
        </div>
        <div id="edit-selected-track"></div>
      ` : ''}
      <div class="edit-actions">
        <button class="btn-cancel" onclick="cancelEdit()">Cancel</button>
        <button class="btn-save" onclick="saveEdit('${id}')">Save</button>
      </div>
    </div>
  `;

  if (spotifyToken) _renderSelected('edit');
}

function cancelEdit() {
  selectedTrack = _savedAddTrack;
  _renderSelected('add');
  renderEntries();
}

async function saveEdit(id) {
  if (!isOwner()) return;
  const topic = document.getElementById(`edit-topic-${id}`).value.trim();
  const note = document.getElementById(`edit-note-${id}`).value.trim();

  if (!topic || !note) {
    alert('Please fill in both fields.');
    return;
  }

  await db.from('entries').update({ topic, note, track: selectedTrack }).eq('id', id);
  selectedTrack = _savedAddTrack;
  _renderSelected('add');
  renderEntries();
}

initAuth();
initSpotify();
