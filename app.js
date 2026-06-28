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
    list.innerHTML = '<p class="empty">No entries yet. Add your first one above!</p>';
    return;
  }

  list.innerHTML = entries
    .slice()
    .reverse()
    .map(e => `
      <div class="entry-card">
        <div class="topic">${e.topic}</div>
        <div class="note">${e.note}</div>
        <div class="date">${e.date}</div>
      </div>
    `)
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

renderEntries();
