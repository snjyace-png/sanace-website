// Studio Log -- private internal project directory (studio-log.html only).
//
// The password typed at the gate is the real secret now (no hardcoded
// password ships in this file anymore) -- it's sent as the Authorization
// header on every call to /api/studio-log, which checks it server-side
// against STUDIO_LOG_API_SECRET (a Vercel environment variable) before
// returning or accepting any data. Entries live in a private GitHub repo,
// synced through that same serverless function; localStorage is kept only
// as an instant-render cache and an offline fallback, never the source of
// truth once unlocked.

var STORAGE_KEY = 'studioLogEntries';
var SECRET_KEY = 'studioLogSecret';
var API_URL = '/api/studio-log';

var logGate = document.getElementById('logGate');
var logApp = document.getElementById('logApp');
var logGateForm = document.getElementById('logGateForm');
var logGatePassword = document.getElementById('logGatePassword');
var logGateError = document.getElementById('logGateError');
var logLogoutBtn = document.getElementById('logLogoutBtn');
var logForm = document.getElementById('logForm');
var logQuickInput = document.getElementById('logQuickInput');
var logSyncStatus = document.getElementById('logSyncStatus');

var currentSecret = null;
var currentEntries = [];
var syncTimer = null;

function getLocalEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch (e) {
    return [];
  }
}

function saveLocalEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

// Older entries (from before this page synced quick freeform notes) used
// separate name/client/category/date/notes fields instead of one `text`
// block -- fold them into a single display string rather than losing them.
function entryDisplayText(entry) {
  if (entry.text != null) return entry.text;
  var head = [entry.name, entry.client].filter(Boolean).join(' — ');
  return [head, entry.notes].filter(Boolean).join('\n');
}

function setSyncStatus(state, message) {
  logSyncStatus.className = 'log-sync-status' + (state ? ' is-' + state : '');
  logSyncStatus.textContent = message || '';
}

function scheduleSync() {
  clearTimeout(syncTimer);
  setSyncStatus('saving', 'Saving…');
  syncTimer = setTimeout(syncToServer, 600);
}

function syncToServer() {
  if (!currentSecret) return;
  fetch(API_URL, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + currentSecret
    },
    body: JSON.stringify({ entries: currentEntries })
  })
    .then(function (res) {
      if (!res.ok) throw new Error('sync failed');
      setSyncStatus('synced', 'Synced');
    })
    .catch(function () {
      setSyncStatus('error', 'Sync failed — saved locally');
    });
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

    var text = document.createElement('p');
    text.className = 'log-entry-text';
    text.textContent = entryDisplayText(entry);
    text.title = 'Click to edit';
    text.addEventListener('click', function () {
      startEditingEntry(entry, card, text);
    });
    card.appendChild(text);

    var meta = document.createElement('p');
    meta.className = 'log-entry-meta';
    meta.textContent = entry.createdAt ? formatDate(entry.createdAt) : '';
    card.appendChild(meta);

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
      saveLocalEntries(currentEntries);
      scheduleSync();
      renderAll(currentEntries);
    });
    controls.appendChild(statusSelect);

    var deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'log-entry-delete';
    deleteBtn.textContent = 'Delete';
    deleteBtn.addEventListener('click', function () {
      if (!confirm('Delete this entry?')) return;
      currentEntries = currentEntries.filter(function (e) { return e.id !== entry.id; });
      saveLocalEntries(currentEntries);
      scheduleSync();
      renderAll(currentEntries);
    });
    controls.appendChild(deleteBtn);

    card.appendChild(controls);
    list.appendChild(card);
  });
}

function startEditingEntry(entry, card, textEl) {
  var input = document.createElement('textarea');
  input.className = 'log-entry-text-input';
  input.value = entryDisplayText(entry);
  input.rows = Math.max(2, input.value.split('\n').length);
  card.replaceChild(input, textEl);
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);

  var committed = false;
  function commit() {
    if (committed) return;
    committed = true;
    var value = input.value.trim();
    if (value) {
      entry.text = value;
      saveLocalEntries(currentEntries);
      scheduleSync();
    }
    renderAll(currentEntries);
  }
  function cancel() {
    if (committed) return;
    committed = true;
    renderAll(currentEntries);
  }

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    }
  });
}

function formatDate(timestamp) {
  var date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function renderAll(entries) {
  renderColumn(entries, 'lead', 'logListLead', 'logCountLead');
  renderColumn(entries, 'ongoing', 'logListOngoing', 'logCountOngoing');
  renderColumn(entries, 'completed', 'logListCompleted', 'logCountCompleted');
}

function unlockLog(secret, entries) {
  currentSecret = secret;
  currentEntries = entries;
  localStorage.setItem(SECRET_KEY, secret);
  saveLocalEntries(entries);
  logGate.hidden = true;
  logApp.hidden = false;
  logLogoutBtn.hidden = false;
  renderAll(currentEntries);
}

function fetchEntries(secret) {
  return fetch(API_URL, {
    headers: { 'Authorization': 'Bearer ' + secret }
  }).then(function (res) {
    if (res.status === 401) {
      var err = new Error('unauthorized');
      err.unauthorized = true;
      throw err;
    }
    if (!res.ok) throw new Error('request failed');
    return res.json();
  }).then(function (data) {
    return data.entries || [];
  });
}

// Auto-unlock on return visits using the cached secret. If the server is
// unreachable, fall back to the local cache rather than locking the page
// out entirely -- it'll try to sync again on the next change.
var cachedSecret = localStorage.getItem(SECRET_KEY);
if (cachedSecret) {
  fetchEntries(cachedSecret)
    .then(function (entries) {
      unlockLog(cachedSecret, entries);
      setSyncStatus('synced', 'Synced');
    })
    .catch(function (err) {
      if (err && err.unauthorized) {
        localStorage.removeItem(SECRET_KEY);
        return;
      }
      unlockLog(cachedSecret, getLocalEntries());
      setSyncStatus('error', 'Offline — showing last saved copy');
    });
}

logGateForm.addEventListener('submit', function (e) {
  e.preventDefault();
  var attempted = logGatePassword.value;
  logGateError.hidden = true;

  fetchEntries(attempted)
    .then(function (entries) {
      logGatePassword.value = '';
      unlockLog(attempted, entries);
      setSyncStatus('synced', 'Synced');
    })
    .catch(function (err) {
      if (err && err.unauthorized) {
        logGateError.textContent = 'Incorrect password.';
      } else {
        logGateError.textContent = "Couldn't reach the server — check your connection and try again.";
      }
      logGateError.hidden = false;
    });
});

logLogoutBtn.addEventListener('click', function () {
  localStorage.removeItem(SECRET_KEY);
  location.reload();
});

// Auto-grow the quick-capture textarea with its content.
function autoGrow() {
  logQuickInput.style.height = 'auto';
  logQuickInput.style.height = logQuickInput.scrollHeight + 'px';
}
logQuickInput.addEventListener('input', autoGrow);

logQuickInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    logForm.requestSubmit();
  }
});

logForm.addEventListener('submit', function (e) {
  e.preventDefault();
  var value = logQuickInput.value.trim();
  if (!value) return;

  currentEntries.push({
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
    text: value,
    status: 'lead',
    createdAt: Date.now()
  });
  saveLocalEntries(currentEntries);
  scheduleSync();
  renderAll(currentEntries);

  logForm.reset();
  autoGrow();
  logQuickInput.focus();
});
