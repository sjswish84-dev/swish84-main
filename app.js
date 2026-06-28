/* ── Background Canvas Animation ── */
(function () {
  const canvas = document.getElementById('bg-canvas');
  const ctx = canvas.getContext('2d');
  const CELL = 48;
  let W, H, cols, rows, nodes, offset = 0;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
    cols = Math.ceil(W / CELL) + 2;
    rows = Math.ceil(H / CELL) + 2;
    buildNodes();
  }

  function buildNodes() {
    nodes = [];
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (Math.random() < 0.18) {
          nodes.push({ c, r, phase: Math.random() * Math.PI * 2, speed: 0.004 + Math.random() * 0.008 });
        }
      }
    }
  }

  function draw(ts) {
    ctx.clearRect(0, 0, W, H);
    offset = (ts * 0.012) % CELL;

    // Grid lines
    ctx.lineWidth = 0.5;
    for (let c = 0; c < cols; c++) {
      const x = c * CELL - offset;
      const alpha = 0.028 + 0.012 * Math.sin(ts * 0.0003 + c * 0.3);
      ctx.strokeStyle = `rgba(0, 212, 255, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let r = 0; r < rows; r++) {
      const y = r * CELL - offset;
      const alpha = 0.018 + 0.008 * Math.sin(ts * 0.0002 + r * 0.4);
      ctx.strokeStyle = `rgba(124, 58, 237, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Glowing nodes at intersections
    nodes.forEach(n => {
      n.phase += n.speed;
      const pulse = (Math.sin(n.phase) + 1) / 2;
      const x = n.c * CELL - offset;
      const y = n.r * CELL - offset;
      const radius = 1.5 + pulse * 2;
      const alpha = 0.15 + pulse * 0.55;

      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius * 4);
      grad.addColorStop(0, `rgba(0, 212, 255, ${alpha})`);
      grad.addColorStop(1, `rgba(0, 212, 255, 0)`);
      ctx.beginPath();
      ctx.arc(x, y, radius * 4, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 212, 255, ${alpha})`;
      ctx.fill();
    });

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
