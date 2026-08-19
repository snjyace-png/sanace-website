// Studio Log -- private internal project directory (studio-log.html only)

// CHANGE THIS to your own password. This is a client-side check only, not
// real security -- anyone who reads this file can see it. Good enough to
// keep the page off casual view, not for protecting sensitive data.
var STUDIO_LOG_PASSWORD = 'changeme';

var STORAGE_KEY = 'studioLogEntries';
var UNLOCK_KEY = 'studioLogUnlocked';

var CATEGORY_LABELS = {
  storyboard: 'Storyboarding & Concept Art',
  '3d': '3D Visualization',
  production: 'Production Design & Art Department'
};

var logGate = document.getElementById('logGate');
var logApp = document.getElementById('logApp');
var logGateForm = document.getElementById('logGateForm');
var logGatePassword = document.getElementById('logGatePassword');
var logGateError = document.getElementById('logGateError');
var logLogoutBtn = document.getElementById('logLogoutBtn');
var logForm = document.getElementById('logForm');

function getEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function renderColumn(entries, status, listId, countId) {
  var list = document.getElementById(listId);
  var matching = entries.filter(function (entry) { return entry.status === status; });
  document.getElementById(countId).textContent = matching.length ? '(' + matching.length + ')' : '';

  if (matching.length === 0) {
    list.innerHTML = '<p class="log-empty">Nothing here yet.</p>';
    return;
  }

  list.innerHTML = '';
  matching.forEach(function (entry) {
    var card = document.createElement('article');
    card.className = 'log-entry';

    var title = document.createElement('p');
    title.className = 'log-entry-title';
    title.textContent = entry.name;
    card.appendChild(title);

    var meta = document.createElement('p');
    meta.className = 'log-entry-meta';
    meta.textContent = [entry.client, CATEGORY_LABELS[entry.category], entry.date].filter(Boolean).join(' · ');
    card.appendChild(meta);

    if (entry.notes) {
      var notes = document.createElement('p');
      notes.className = 'log-entry-notes';
      notes.textContent = entry.notes;
      card.appendChild(notes);
    }

    var controls = document.createElement('div');
    controls.className = 'log-entry-controls';

    var statusSelect = document.createElement('select');
    ['lead', 'ongoing', 'completed'].forEach(function (value) {
      var option = document.createElement('option');
      option.value = value;
      option.textContent = value === 'lead' ? 'New Lead' : value.charAt(0).toUpperCase() + value.slice(1);
      if (value === entry.status) option.selected = true;
      statusSelect.appendChild(option);
    });
    statusSelect.addEventListener('change', function () {
      entry.status = statusSelect.value;
      saveEntries(entries);
      renderAll(entries);
    });
    controls.appendChild(statusSelect);

    var deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'log-entry-delete';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', function () {
      if (!confirm('Delete "' + entry.name + '"?')) return;
      var next = entries.filter(function (e) { return e.id !== entry.id; });
      saveEntries(next);
      renderAll(next);
    });
    controls.appendChild(deleteBtn);

    card.appendChild(controls);
    list.appendChild(card);
  });
}

function renderAll(entries) {
  renderColumn(entries, 'lead', 'logListLead', 'logCountLead');
  renderColumn(entries, 'ongoing', 'logListOngoing', 'logCountOngoing');
  renderColumn(entries, 'completed', 'logListCompleted', 'logCountCompleted');
}

function unlockLog() {
  logGate.hidden = true;
  logApp.hidden = false;
  logLogoutBtn.hidden = false;
  renderAll(getEntries());
}

if (localStorage.getItem(UNLOCK_KEY) === 'true') {
  unlockLog();
}

logGateForm.addEventListener('submit', function (e) {
  e.preventDefault();
  if (logGatePassword.value === STUDIO_LOG_PASSWORD) {
    localStorage.setItem(UNLOCK_KEY, 'true');
    logGateError.hidden = true;
    logGatePassword.value = '';
    unlockLog();
  } else {
    logGateError.hidden = false;
  }
});

logLogoutBtn.addEventListener('click', function () {
  localStorage.removeItem(UNLOCK_KEY);
  location.reload();
});

logForm.addEventListener('submit', function (e) {
  e.preventDefault();
  var entries = getEntries();
  entries.push({
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    name: document.getElementById('logFieldName').value.trim(),
    client: document.getElementById('logFieldClient').value.trim(),
    category: document.getElementById('logFieldCategory').value,
    status: document.getElementById('logFieldStatus').value,
    date: document.getElementById('logFieldDate').value.trim(),
    notes: document.getElementById('logFieldNotes').value.trim()
  });
  saveEntries(entries);
  renderAll(entries);
  logForm.reset();
});
