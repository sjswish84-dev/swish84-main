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
