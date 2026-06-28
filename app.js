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
    [0, 210, 180],    // teal
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

        const radius = 1.5 + pulse * 2;
        const alpha = 0.15 + pulse * 0.55;

        const grad = ctx.createRadialGradient(x, y, 0, x, y, radius * 5);
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.beginPath();
        ctx.arc(x, y, radius * 5, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        ctx.fill();
      }
    }

    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(draw);
})();


/* ── TIL App ── */
function loadEntries() {
  return JSON.parse(localStorage.getItem('til-entries') || '[]');
}

function saveEntries(entries) {
  localStorage.setItem('til-entries', JSON.stringify(entries));
}

function renderEntries() {
  const list = document.getElementById('entry-list');
  const entries = loadEntries();

  if (entries.length === 0) {
    list.innerHTML = '<p class="empty">No entries yet — add your first one above!</p>';
    return;
  }

  list.innerHTML = entries
    .slice()
    .reverse()
    .map((e, reversedIndex) => {
      const realIndex = entries.length - 1 - reversedIndex;
      return `
        <div class="entry-card" id="card-${realIndex}">
          <div class="entry-card-header">
            <div class="topic">
              <span class="topic-pill">${e.topic}</span>
            </div>
            <div class="card-actions">
              <button class="btn-edit" onclick="startEdit(${realIndex})">Edit</button>
              <button class="btn-delete" onclick="deleteEntry(${realIndex})">Delete</button>
            </div>
          </div>
          <div class="note">${e.note}</div>
          <div class="date">${e.date}</div>
        </div>
      `;
    })
    .join('');
}

function addEntry() {
  const topic = document.getElementById('topic').value.trim();
  const note = document.getElementById('note').value.trim();

  if (!topic || !note) {
    alert('Please fill in both fields.');
    return;
  }

  const entries = loadEntries();
  entries.push({
    topic,
    note,
    date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  });
  saveEntries(entries);

  document.getElementById('topic').value = '';
  document.getElementById('note').value = '';

  renderEntries();
}

function deleteEntry(index) {
  if (!confirm('Delete this entry?')) return;
  const entries = loadEntries();
  entries.splice(index, 1);
  saveEntries(entries);
  renderEntries();
}

function startEdit(index) {
  const entries = loadEntries();
  const e = entries[index];
  const card = document.getElementById(`card-${index}`);

  card.innerHTML = `
    <div class="edit-form">
      <input type="text" id="edit-topic-${index}" value="${e.topic}" />
      <textarea id="edit-note-${index}">${e.note}</textarea>
      <div class="edit-actions">
        <button class="btn-cancel" onclick="renderEntries()">Cancel</button>
        <button class="btn-save" onclick="saveEdit(${index})">Save</button>
      </div>
    </div>
  `;
}

function saveEdit(index) {
  const topic = document.getElementById(`edit-topic-${index}`).value.trim();
  const note = document.getElementById(`edit-note-${index}`).value.trim();

  if (!topic || !note) {
    alert('Please fill in both fields.');
    return;
  }

  const entries = loadEntries();
  entries[index].topic = topic;
  entries[index].note = note;
  saveEntries(entries);
  renderEntries();
}

renderEntries();
