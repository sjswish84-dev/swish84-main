/* ── Background Canvas Animation ── */
(function () {
  const canvas = document.getElementById('bg-canvas');
  const ctx = canvas.getContext('2d');
  const CELL = 48;
  let W, H, cols, rows;

  // Deterministic hash from grid coords — no random(), so no jerk on tile wrap
  function hash(c, r, salt) {
    return Math.abs(Math.sin(c * 127.1 + r * 311.7 + (salt || 0) * 74.3));
  }

  const NODE_COLORS = [
    [0, 212, 255],    // cyan-teal matching hero
    [160, 60, 255],   // purple
    [255, 60, 180],   // pink
  ];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    cols = Math.ceil(W / CELL) + 3;
    rows = Math.ceil(H / CELL) + 3;
  }

  function draw(ts) {
    ctx.clearRect(0, 0, W, H);

    const scroll = ts * 0.012;
    const offsetX = scroll % CELL;
    const startC = Math.floor(scroll / CELL);
    const startR = Math.floor(scroll / CELL);

    // Vertical grid lines — cyan
    ctx.lineWidth = 0.5;
    for (let dc = -1; dc <= cols; dc++) {
      const x = dc * CELL - offsetX;
      if (x < -CELL || x > W + CELL) continue;
      const alpha = 0.025 + 0.012 * Math.sin(ts * 0.0003 + (startC + dc) * 0.3);
      ctx.strokeStyle = `rgba(0, 212, 255, ${alpha})`;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }

    // Horizontal grid lines — purple
    for (let dr = -1; dr <= rows; dr++) {
      const y = dr * CELL - offsetX;
      if (y < -CELL || y > H + CELL) continue;
      const alpha = 0.018 + 0.008 * Math.sin(ts * 0.0002 + (startR + dr) * 0.4);
      ctx.strokeStyle = `rgba(124, 58, 237, ${alpha})`;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Nodes — presence, color, and pulse all derived from absolute grid coords
    for (let dc = -1; dc <= cols; dc++) {
      for (let dr = -1; dr <= rows; dr++) {
        const absC = startC + dc;
        const absR = startR + dr;

        if (hash(absC, absR, 0) < 0.82) continue; // ~18% of intersections

        const x = dc * CELL - offsetX;
        const y = dr * CELL - offsetX;
        if (x < -CELL || x > W + CELL || y < -CELL || y > H + CELL) continue;

        const basePhase = hash(absC, absR, 1) * Math.PI * 2;
        const speed = 0.001 + hash(absC, absR, 2) * 0.002;
        const pulse = (Math.sin(basePhase + ts * speed) + 1) / 2;

        const colorIdx = ((absC * 2 + absR * 3) % 3 + 3) % 3;
        const [r, g, b] = NODE_COLORS[colorIdx];

        const size = 1 + pulse * 1.5;
        const alpha = 0.2 + pulse * 0.7;
        const arm = size * 5;

        // cross arms
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${alpha * 0.5})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x - arm, y); ctx.lineTo(x + arm, y);
        ctx.moveTo(x, y - arm); ctx.lineTo(x, y + arm);
        ctx.stroke();

        // soft glow behind star
        const glow = ctx.createRadialGradient(x, y, 0, x, y, arm * 2);
        glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha * 0.3})`);
        glow.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.beginPath();
        ctx.arc(x, y, arm * 2, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        // bright white center
        ctx.beginPath();
        ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.fill();
      }
    }

    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(draw);
})();


/* ── Supabase Client ── */
const { createClient } = supabase;
const db = createClient(
  'https://dfbjgoyaujlbwrptzoxs.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmYmpnb3lhdWpsYndycHR6b3hzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MDc0MDAsImV4cCI6MjA5ODE4MzQwMH0.wcs6Q5XgeW3PjUrU30y4yV1ljKofYgVgCc7dy-Fodak'
);

/* ── TIL App ── */
let currentEntries = [];

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
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
        <div class="card-actions">
          <button class="btn-edit" onclick="startEdit('${e.id}')">Edit</button>
          <button class="btn-delete" onclick="deleteEntry('${e.id}')">Delete</button>
        </div>
      </div>
      <div class="note">${esc(e.note)}</div>
      <div class="date">${esc(e.date)}</div>
    </div>
  `).join('');
}

async function addEntry() {
  const topic = document.getElementById('topic').value.trim();
  const note = document.getElementById('note').value.trim();

  if (!topic || !note) {
    alert('Please fill in both fields.');
    return;
  }

  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const { error } = await db.from('entries').insert([{ topic, note, date }]);

  if (error) {
    alert('Error saving entry.');
    return;
  }

  document.getElementById('topic').value = '';
  document.getElementById('note').value = '';
  renderEntries();
}

async function deleteEntry(id) {
  if (!confirm('Delete this entry?')) return;
  await db.from('entries').delete().eq('id', id);
  renderEntries();
}

function startEdit(id) {
  const e = currentEntries.find(e => e.id === id);
  const card = document.getElementById(`card-${id}`);

  card.innerHTML = `
    <div class="edit-form">
      <input type="text" id="edit-topic-${id}" value="${esc(e.topic)}" />
      <textarea id="edit-note-${id}">${esc(e.note)}</textarea>
      <div class="edit-actions">
        <button class="btn-cancel" onclick="renderEntries()">Cancel</button>
        <button class="btn-save" onclick="saveEdit('${id}')">Save</button>
      </div>
    </div>
  `;
}

async function saveEdit(id) {
  const topic = document.getElementById(`edit-topic-${id}`).value.trim();
  const note = document.getElementById(`edit-note-${id}`).value.trim();

  if (!topic || !note) {
    alert('Please fill in both fields.');
    return;
  }

  await db.from('entries').update({ topic, note }).eq('id', id);
  renderEntries();
}

renderEntries();
