(function () {
  'use strict';

  var STORAGE_KEY = 'studioOsState';
  var SECRET_KEY = 'studioLogSecret'; // shared with Studio Log / Wiki — one unlock covers all three
  var API_URL = '/api/studio-os';

  var EMPTY_STATE = {
    leads: [],
    projects: [],
    logs: [],
    contacts: [],
    counters: { lead: 0, project: 0, log: 0, contact: 0 }
  };

  var state = null;
  var currentSecret = null;
  var currentView = 'leads';
  var currentDetailId = null;
  var syncTimer = null;

  var osGate = document.getElementById('osGate');
  var osGateForm = document.getElementById('osGateForm');
  var osGatePassword = document.getElementById('osGatePassword');
  var osGateError = document.getElementById('osGateError');
  var osApp = document.getElementById('osApp');
  var osLogoutBtn = document.getElementById('osLogoutBtn');
  var osRefreshBtn = document.getElementById('osRefreshBtn');
  var osSyncStatus = document.getElementById('osSyncStatus');
  var osNav = document.getElementById('osNav');

  var LEAD_STATUSES = ['new', 'contacted', 'meeting', 'discussion', 'confirmed', 'converted', 'lost', 'on-hold'];
  var LEAD_STATUS_LABELS = {
    'new': 'New', 'contacted': 'Contacted', 'meeting': 'Meeting', 'discussion': 'Discussion',
    'confirmed': 'Confirmed', 'converted': 'Converted', 'lost': 'Lost', 'on-hold': 'On Hold'
  };
  var PROJECT_STATUSES = ['not-started', 'active', 'waiting', 'on-hold', 'completed'];
  var PROJECT_STATUS_LABELS = {
    'not-started': 'Not Started', 'active': 'Active', 'waiting': 'Waiting',
    'on-hold': 'On Hold', 'completed': 'Completed'
  };
  var CONTACT_CATEGORIES = ['client', 'referrer', 'vendor', 'collaborator', 'other'];
  var CONTACT_CATEGORY_LABELS = {
    'client': 'Client', 'referrer': 'Referrer', 'vendor': 'Vendor',
    'collaborator': 'Collaborator', 'other': 'Other'
  };
  var LOG_TYPES = ['note', 'call', 'email', 'meeting', 'decision', 'feedback', 'milestone', 'delivery'];
  var LOG_TYPE_LABELS = {
    'note': 'Note', 'call': 'Call', 'email': 'Email', 'meeting': 'Meeting',
    'decision': 'Decision', 'feedback': 'Feedback', 'milestone': 'Milestone', 'delivery': 'Delivery'
  };

  var leadsViewState = { mode: 'cards', search: '', filter: 'all', sortKey: 'date', sortDir: 'desc' };
  var projectsViewState = { mode: 'cards', search: '', filter: 'all', sortKey: 'deadline', sortDir: 'asc' };
  var contactsViewState = { mode: 'cards', search: '', filter: 'all', sortKey: 'name', sortDir: 'asc' };

  // ---------------------------------------------------------------------
  // State normalization / persistence
  // ---------------------------------------------------------------------

  function cloneEmptyState() {
    return JSON.parse(JSON.stringify(EMPTY_STATE));
  }

  function normalizeLead(l) {
    return {
      id: l.id, date: l.date || new Date().toISOString(), name: l.name || '',
      service: l.service || '', brief: l.brief || '', estimatedFee: l.estimatedFee || '',
      timing: l.timing || '', status: l.status || 'new', nextFollowUp: l.nextFollowUp || '',
      notes: l.notes || '', projectId: l.projectId || null, convertedDate: l.convertedDate || null,
      contactId: l.contactId || null, source: l.source || '',
      contactPerson: l.contactPerson || '', contactPhone: l.contactPhone || '', contactEmail: l.contactEmail || '',
      tags: Array.isArray(l.tags) ? l.tags : []
    };
  }

  function normalizeProject(p) {
    var contract = p.contract || {};
    var invoice = p.invoice || {};
    var review = p.review || {};
    var caseStudy = p.caseStudy || {};
    return {
      id: p.id, leadId: p.leadId || null, name: p.name || '', service: p.service || '',
      client: p.client || '', startDate: p.startDate || '', deadline: p.deadline || '',
      status: p.status || 'not-started', completed: !!p.completed, progress: p.progress || 0,
      fee: p.fee || '', notes: p.notes || '', phases: Array.isArray(p.phases) ? p.phases : [],
      deliverables: Array.isArray(p.deliverables) ? p.deliverables : [],
      expenses: Array.isArray(p.expenses) ? p.expenses : [],
      driveLinks: Array.isArray(p.driveLinks) ? p.driveLinks : [],
      contract: {
        scope: contract.scope || '', terms: contract.terms || '',
        paymentSchedule: contract.paymentSchedule || '', status: contract.status || 'draft',
        notes: contract.notes || ''
      },
      invoice: {
        items: Array.isArray(invoice.items) ? invoice.items : [],
        taxPercent: invoice.taxPercent || '', status: invoice.status || 'draft',
        issuedDate: invoice.issuedDate || ''
      },
      review: {
        rating: review.rating || '', wouldRecommend: review.wouldRecommend || '',
        testimonial: review.testimonial || '', notes: review.notes || ''
      },
      caseStudy: { status: caseStudy.status || 'not-ready', summary: caseStudy.summary || '' }
    };
  }

  function normalizeContact(c) {
    return {
      id: c.id, name: c.name || '', company: c.company || '', phone: c.phone || '',
      email: c.email || '', website: c.website || '', instagram: c.instagram || '',
      linkedin: c.linkedin || '', notes: c.notes || '',
      category: c.category || '', tags: Array.isArray(c.tags) ? c.tags : []
    };
  }

  function normalizeLog(l) {
    var entityType = l.entityType || (l.projectId ? 'project' : null);
    var entityId = l.entityId || l.projectId || null;
    return {
      id: l.id, date: l.date || new Date().toISOString(), entityType: entityType, entityId: entityId,
      type: l.type || 'note', note: l.note || '', decision: l.decision || '',
      nextAction: l.nextAction || '', link: l.link || ''
    };
  }

  function normalizeState(raw) {
    var s = raw && typeof raw === 'object' ? raw : {};
    return {
      leads: (Array.isArray(s.leads) ? s.leads : []).map(normalizeLead),
      projects: (Array.isArray(s.projects) ? s.projects : []).map(normalizeProject),
      logs: (Array.isArray(s.logs) ? s.logs : []).map(normalizeLog),
      contacts: (Array.isArray(s.contacts) ? s.contacts : []).map(normalizeContact),
      counters: Object.assign({ lead: 0, project: 0, log: 0, contact: 0 }, s.counters || {})
    };
  }

  function getLocalState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeState(JSON.parse(raw)) : null;
    } catch (e) {
      return null;
    }
  }

  function saveLocalState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* ignore quota errors */ }
  }

  function setSyncStatus(kind, text) {
    if (!osSyncStatus) return;
    osSyncStatus.textContent = text;
    osSyncStatus.classList.toggle('is-error', kind === 'error');
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
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + currentSecret },
      body: JSON.stringify(state)
    })
      .then(function (res) {
        if (!res.ok) throw new Error('sync failed');
        setSyncStatus('synced', 'Synced');
      })
      .catch(function () {
        setSyncStatus('error', 'Sync failed — saved locally');
      });
  }

  function fetchState(secret) {
    return fetch(API_URL, { headers: { 'Authorization': 'Bearer ' + secret } }).then(function (res) {
      if (res.status === 401) {
        var err = new Error('unauthorized');
        err.unauthorized = true;
        throw err;
      }
      if (!res.ok) throw new Error('request failed');
      return res.json();
    }).then(function (data) { return normalizeState(data); });
  }

  function genId(type) {
    state.counters[type] = (state.counters[type] || 0) + 1;
    var prefix = { lead: 'LEAD', project: 'PROJ', log: 'LOG', contact: 'CONTACT' }[type];
    var num = String(state.counters[type]);
    while (num.length < 4) num = '0' + num;
    return prefix + '-' + num;
  }

  function findLead(id) { return state.leads.filter(function (l) { return l.id === id; })[0]; }
  function findProject(id) { return state.projects.filter(function (p) { return p.id === id; })[0]; }
  function findContact(id) { return state.contacts.filter(function (c) { return c.id === id; })[0]; }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function shortDate(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }

  function parseTags(input) {
    return input.split(',').map(function (t) { return t.trim(); }).filter(Boolean);
  }

  function tagChipsHtml(tags) {
    if (!tags || !tags.length) return '';
    return '<div class="tag-chip-row">' + tags.map(function (t) {
      return '<span class="tag-chip">' + escapeHtml(t) + '</span>';
    }).join('') + '</div>';
  }

  // ---------------------------------------------------------------------
  // Generic sort helper (shared by Leads/Projects/Contacts table+cards)
  // ---------------------------------------------------------------------

  function sortItems(items, sortKey, sortDir, accessor) {
    var sorted = items.slice().sort(function (a, b) {
      var av = accessor(a, sortKey);
      var bv = accessor(b, sortKey);
      if (av == null) av = '';
      if (bv == null) bv = '';
      if (typeof av === 'number' && typeof bv === 'number') return av - bv;
      return String(av).localeCompare(String(bv));
    });
    if (sortDir === 'desc') sorted.reverse();
    return sorted;
  }

  function setupSortableTable(table, viewState, onSort) {
    var ths = table.querySelectorAll('th[data-sort]');
    for (var i = 0; i < ths.length; i++) {
      var th = ths[i];
      var key = th.getAttribute('data-sort');
      if (key === viewState.sortKey) {
        th.setAttribute('data-sort-active', '');
        th.setAttribute('data-sort-dir', viewState.sortDir === 'asc' ? '▲' : '▼');
      }
      th.addEventListener('click', function () {
        var k = this.getAttribute('data-sort');
        if (viewState.sortKey === k) {
          viewState.sortDir = viewState.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          viewState.sortKey = k;
          viewState.sortDir = 'asc';
        }
        onSort();
      });
    }
  }

  // ---------------------------------------------------------------------
  // Generalized Activity Log (Leads, Projects, Contacts)
  // ---------------------------------------------------------------------

  function logsForEntity(entityType, entityId) {
    return state.logs.filter(function (l) { return l.entityType === entityType && l.entityId === entityId; })
      .slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
  }

  function renderActivityLog(entityType, entityId) {
    var logs = logsForEntity(entityType, entityId);
    var typeOptions = LOG_TYPES.map(function (t) {
      return '<option value="' + t + '">' + LOG_TYPE_LABELS[t] + '</option>';
    }).join('');
    var logsHtml = logs.map(function (log) {
      return '<div class="log-feed-item">' +
        '<div class="log-feed-item-meta"><span class="log-feed-item-type">' + escapeHtml(LOG_TYPE_LABELS[log.type] || log.type) + '</span><span>' + shortDate(log.date) + '</span></div>' +
        '<div class="log-feed-item-note">' + escapeHtml(log.note) + '</div>' +
        (log.nextAction ? '<div class="log-feed-item-next">Next: ' + escapeHtml(log.nextAction) + '</div>' : '') +
      '</div>';
    }).join('') || '<p class="log-empty">No interactions logged yet.</p>';

    return '<div class="detail-section">' +
      '<h3>Interaction Log</h3>' +
      '<form class="log-quick-bar" onsubmit="return addActivityLog(event,\'' + entityType + '\',\'' + entityId + '\')">' +
        '<select class="new-log-type" style="flex-shrink:0;border-radius:0.6rem;border:1px solid var(--c-border);background-color:var(--c-bg);color:var(--c-text);padding:0.65rem;font-family:var(--font-sans);">' + typeOptions + '</select>' +
        '<textarea class="new-log-note" rows="1" placeholder="What happened…" required></textarea>' +
        '<button type="submit" class="pill-btn">Add</button>' +
      '</form>' +
      '<div class="log-feed">' + logsHtml + '</div>' +
    '</div>';
  }

  window.addActivityLog = function (e, entityType, entityId) {
    e.preventDefault();
    var form = e.target;
    var typeSelect = form.querySelector('.new-log-type');
    var noteInput = form.querySelector('.new-log-note');
    var note = noteInput.value.trim();
    if (!note) return false;
    state.logs.push({
      id: genId('log'),
      date: new Date().toISOString(),
      entityType: entityType,
      entityId: entityId,
      type: typeSelect.value,
      note: note,
      decision: '',
      nextAction: '',
      link: ''
    });
    saveLocalState();
    scheduleSync();
    if (entityType === 'lead') renderLeadDetail(entityId);
    if (entityType === 'project') renderProjectDetail(entityId);
    if (entityType === 'contact') renderContactDetail(entityId);
    return false;
  };

  // ---------------------------------------------------------------------
  // View switching
  // ---------------------------------------------------------------------

  function showView(name) {
    currentView = name;
    var views = document.querySelectorAll('.studio-view');
    for (var i = 0; i < views.length; i++) {
      views[i].hidden = views[i].getAttribute('data-view') !== name;
    }
    var topLevel = name;
    if (name === 'lead-detail') topLevel = 'leads';
    if (name === 'project-detail') topLevel = 'projects';
    if (name === 'contact-detail') topLevel = 'contacts';
    var navButtons = osNav.querySelectorAll('button');
    for (var j = 0; j < navButtons.length; j++) {
      navButtons[j].classList.toggle('is-active', navButtons[j].getAttribute('data-view') === topLevel);
    }
  }

  osNav.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-view]');
    if (!btn) return;
    window.showView(btn.getAttribute('data-view'));
  });

  window.showView = function (name) {
    showView(name);
    if (name === 'leads' || name === 'projects' || name === 'timeline' || name === 'contacts') currentDetailId = null;
    if (name === 'leads') renderLeads();
    if (name === 'projects') renderProjects();
    if (name === 'timeline') renderTimeline();
    if (name === 'contacts') renderContacts();
  };

  // ---------------------------------------------------------------------
  // Leads
  // ---------------------------------------------------------------------

  function leadAccessor(lead, key) {
    if (key === 'fee') return parseFloat(lead.estimatedFee) || 0;
    if (key === 'name') return (lead.name || '').toLowerCase();
    if (key === 'service') return (lead.service || '').toLowerCase();
    if (key === 'status') return lead.status || '';
    if (key === 'nextFollowUp') return lead.nextFollowUp || '';
    return lead.date || '';
  }

  function leadMatches(lead, vs) {
    if (vs.filter !== 'all' && lead.status !== vs.filter) return false;
    var q = vs.search.trim().toLowerCase();
    if (!q) return true;
    var hay = [lead.name, lead.service, lead.notes, lead.brief, (lead.tags || []).join(' ')].join(' ').toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function renderLeads() {
    var list = document.getElementById('leadsList');
    list.innerHTML = '';
    var filtered = state.leads.filter(function (l) { return leadMatches(l, leadsViewState); });
    if (!state.leads.length) {
      list.innerHTML = '<p class="log-empty">No leads yet — jot one down above.</p>';
      return;
    }
    if (!filtered.length) {
      list.innerHTML = '<p class="log-empty">No leads match your search/filter.</p>';
      return;
    }
    var leads = sortItems(filtered, leadsViewState.sortKey, leadsViewState.sortDir, leadAccessor);

    if (leadsViewState.mode === 'table') {
      renderLeadsTable(list, leads);
      return;
    }

    leads.forEach(function (lead) {
      var card = document.createElement('div');
      card.className = 'lead-card';
      card.setAttribute('data-lead-id', lead.id);
      card.setAttribute('tabindex', '0');
      var metaParts = [];
      if (lead.service) metaParts.push(lead.service);
      if (lead.estimatedFee) metaParts.push('₹' + lead.estimatedFee);
      if (lead.nextFollowUp) metaParts.push('Follow up ' + shortDate(lead.nextFollowUp));
      card.innerHTML =
        '<div class="lead-card-main">' +
          '<span class="lead-card-name">' + escapeHtml(lead.name) + '</span>' +
          '<span class="lead-card-meta">' + escapeHtml(metaParts.join(' · ')) + '</span>' +
          tagChipsHtml(lead.tags) +
        '</div>' +
        '<span class="status-pill is-' + lead.status + '">' + escapeHtml(LEAD_STATUS_LABELS[lead.status] || lead.status) + '</span>';
      card.addEventListener('click', function () { openLeadDetail(lead.id); });
      list.appendChild(card);
    });
  }

  function renderLeadsTable(list, leads) {
    var wrap = document.createElement('div');
    wrap.className = 'studio-table-wrap';
    wrap.innerHTML =
      '<table class="studio-table"><thead><tr>' +
        '<th data-sort="name">Name</th><th data-sort="service">Service</th><th data-sort="fee">Fee</th>' +
        '<th data-sort="status">Status</th><th data-sort="nextFollowUp">Next Follow-up</th><th>Tags</th>' +
      '</tr></thead><tbody>' +
      leads.map(function (lead) {
        return '<tr data-lead-id="' + lead.id + '">' +
          '<td>' + escapeHtml(lead.name) + '</td>' +
          '<td>' + escapeHtml(lead.service) + '</td>' +
          '<td>' + (lead.estimatedFee ? '₹' + escapeHtml(lead.estimatedFee) : '') + '</td>' +
          '<td><span class="status-pill is-' + lead.status + '">' + escapeHtml(LEAD_STATUS_LABELS[lead.status] || lead.status) + '</span></td>' +
          '<td>' + shortDate(lead.nextFollowUp) + '</td>' +
          '<td>' + tagChipsHtml(lead.tags) + '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table>';
    list.appendChild(wrap);
    setupSortableTable(wrap.querySelector('table'), leadsViewState, renderLeads);
    wrap.querySelectorAll('tbody tr').forEach(function (tr) {
      tr.addEventListener('click', function () { openLeadDetail(tr.getAttribute('data-lead-id')); });
    });
  }

  document.getElementById('leadsSearchInput').addEventListener('input', function (e) {
    leadsViewState.search = e.target.value;
    renderLeads();
  });
  document.getElementById('leadsStatusFilter').addEventListener('change', function (e) {
    leadsViewState.filter = e.target.value;
    renderLeads();
  });
  document.getElementById('leadsViewToggle').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-mode]');
    if (!btn) return;
    leadsViewState.mode = btn.getAttribute('data-mode');
    this.querySelectorAll('button').forEach(function (b) { b.classList.toggle('is-active', b === btn); });
    renderLeads();
  });

  document.getElementById('leadQuickForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var input = document.getElementById('leadQuickInput');
    var name = input.value.trim();
    if (!name) return;
    var lead = normalizeLead({ id: genId('lead'), name: name });
    state.leads.push(lead);
    saveLocalState();
    scheduleSync();
    renderLeads();
    input.value = '';
    input.style.height = '';
    input.focus();
  });

  document.getElementById('leadQuickInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('leadQuickForm').requestSubmit();
    }
  });

  function openLeadDetail(id) {
    currentDetailId = id;
    showView('lead-detail');
    renderLeadDetail(id);
  }
  window.openLeadDetail = openLeadDetail;

  function renderLeadDetail(id) {
    var lead = findLead(id);
    var panel = document.getElementById('leadDetailPanel');
    if (!lead) { panel.innerHTML = ''; return; }

    var statusOptions = LEAD_STATUSES.map(function (s) {
      return '<option value="' + s + '"' + (s === lead.status ? ' selected' : '') + '>' + LEAD_STATUS_LABELS[s] + '</option>';
    }).join('');

    var contactDisplay = lead.contactId && findContact(lead.contactId) ? findContact(lead.contactId).name : (lead.source || '');

    var actions = '';
    if (lead.status === 'confirmed') {
      actions += '<button type="button" class="pill-btn" onclick="convertLead(\'' + lead.id + '\')">Convert to Project</button>';
    }
    if (lead.projectId && findProject(lead.projectId)) {
      actions += '<button type="button" class="pill-btn pill-btn-outline" onclick="openProjectDetail(\'' + lead.projectId + '\')">Open Project</button>';
    }
    actions += '<button type="button" class="log-entry-delete" onclick="deleteLead(\'' + lead.id + '\')">Delete lead</button>';

    panel.innerHTML =
      '<button type="button" class="detail-back" onclick="showView(\'leads\')">&larr; Back to Leads</button>' +
      '<div><p class="eyebrow">Lead &middot; ' + lead.id + '</p><h1 class="case-title">' + escapeHtml(lead.name) + '</h1></div>' +
      '<div class="detail-fields">' +
        field('Name', 'text', 'name', lead.name) +
        field('Service', 'text', 'service', lead.service) +
        field('Estimated Fee (₹)', 'text', 'estimatedFee', lead.estimatedFee) +
        field('Timing', 'text', 'timing', lead.timing) +
        field('Next Follow-up', 'date', 'nextFollowUp', lead.nextFollowUp) +
        '<div class="detail-field"><label>Status</label><select onchange="updateLeadField(\'' + lead.id + '\',\'status\',this.value)">' + statusOptions + '</select></div>' +
        field('Contact Person', 'text', 'contactPerson', lead.contactPerson) +
        field('Contact Phone', 'text', 'contactPhone', lead.contactPhone) +
        field('Contact Email', 'text', 'contactEmail', lead.contactEmail) +
        field('Tags (comma-separated)', 'text', 'tagsRaw', lead.tags.join(', ')) +
        '<div class="detail-field contact-picker">' +
          '<label>Referred by</label>' +
          '<input type="text" id="leadContactInput" value="' + escapeHtml(contactDisplay) + '" placeholder="Type a name or contact…" oninput="onLeadContactInput(\'' + lead.id + '\', this.value)" onblur="setTimeout(function(){var r=document.getElementById(\'leadContactResults\'); if(r) r.hidden=true;},150)">' +
          '<div class="contact-picker-results" id="leadContactResults" hidden></div>' +
        '</div>' +
      '</div>' +
      '<div class="detail-field"><label>Brief</label><textarea rows="3" onchange="updateLeadField(\'' + lead.id + '\',\'brief\',this.value)">' + escapeHtml(lead.brief) + '</textarea></div>' +
      '<div class="detail-field"><label>Notes</label><textarea rows="3" onchange="updateLeadField(\'' + lead.id + '\',\'notes\',this.value)">' + escapeHtml(lead.notes) + '</textarea></div>' +
      '<div class="detail-actions">' + actions + '</div>' +
      renderActivityLog('lead', lead.id);

    function field(label, type, key, value) {
      return '<div class="detail-field"><label>' + label + '</label><input type="' + type + '" value="' + escapeHtml(value) + '" onchange="updateLeadField(\'' + lead.id + '\',\'' + key + '\',this.value)"></div>';
    }
  }

  window.updateLeadField = function (id, key, value) {
    var lead = findLead(id);
    if (!lead) return;
    if (key === 'tagsRaw') {
      lead.tags = parseTags(value);
    } else {
      lead[key] = value;
    }
    saveLocalState();
    scheduleSync();
    if (key === 'status') renderLeadDetail(id);
  };

  window.deleteLead = function (id) {
    if (!window.confirm('Delete this lead?')) return;
    state.leads = state.leads.filter(function (l) { return l.id !== id; });
    state.logs = state.logs.filter(function (l) { return !(l.entityType === 'lead' && l.entityId === id); });
    saveLocalState();
    scheduleSync();
    window.showView('leads');
  };

  window.onLeadContactInput = function (leadId, value) {
    var lead = findLead(leadId);
    if (!lead) return;
    lead.source = value;
    lead.contactId = null;
    saveLocalState();
    scheduleSync();
    var results = document.getElementById('leadContactResults');
    if (!results) return;
    var q = value.trim().toLowerCase();
    if (!q) { results.hidden = true; results.innerHTML = ''; return; }
    var matches = state.contacts.filter(function (c) {
      return c.name && c.name.toLowerCase().indexOf(q) !== -1;
    });
    if (!matches.length) { results.hidden = true; results.innerHTML = ''; return; }
    results.innerHTML = matches.map(function (c) {
      return '<button type="button" class="contact-picker-result" onmousedown="pickLeadContact(\'' + leadId + '\',\'' + c.id + '\')">' + escapeHtml(c.name) + (c.company ? ' — ' + escapeHtml(c.company) : '') + '</button>';
    }).join('');
    results.hidden = false;
  };

  window.pickLeadContact = function (leadId, contactId) {
    var lead = findLead(leadId);
    var contact = findContact(contactId);
    if (!lead || !contact) return;
    lead.contactId = contact.id;
    lead.source = contact.name;
    saveLocalState();
    scheduleSync();
    renderLeadDetail(leadId);
  };

  // ---------------------------------------------------------------------
  // Lead → Project conversion
  // ---------------------------------------------------------------------

  window.convertLead = function (leadId) {
    var lead = findLead(leadId);
    if (!lead || lead.status === 'converted') return;
    var project = normalizeProject({
      id: genId('project'), leadId: lead.id, name: lead.name, service: lead.service,
      client: lead.name, fee: lead.estimatedFee, notes: lead.brief
    });
    state.projects.push(project);
    lead.status = 'converted';
    lead.projectId = project.id;
    lead.convertedDate = new Date().toISOString();
    saveLocalState();
    scheduleSync();
    openProjectDetail(project.id);
  };

  // ---------------------------------------------------------------------
  // Projects
  // ---------------------------------------------------------------------

  function recalcProgress(project) {
    if (!project.phases || !project.phases.length) {
      project.progress = project.completed ? 100 : 0;
      return;
    }
    var done = project.phases.filter(function (p) { return p.done; }).length;
    project.progress = Math.round((done / project.phases.length) * 100);
  }

  function projectAccessor(project, key) {
    if (key === 'name') return (project.name || '').toLowerCase();
    if (key === 'client') return (project.client || '').toLowerCase();
    if (key === 'status') return project.status || '';
    if (key === 'deadline') return project.deadline || '';
    if (key === 'progress') return project.progress || 0;
    return project.deadline || '';
  }

  function projectMatches(project, vs) {
    if (vs.filter !== 'all' && project.status !== vs.filter) return false;
    var q = vs.search.trim().toLowerCase();
    if (!q) return true;
    var hay = [project.name, project.client, project.service, project.notes].join(' ').toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function renderProjects() {
    var list = document.getElementById('projectsList');
    var emptyNote = document.getElementById('projectsEmptyNote');
    list.innerHTML = '';
    if (!state.projects.length) {
      emptyNote.hidden = false;
      return;
    }
    emptyNote.hidden = true;
    var filtered = state.projects.filter(function (p) { return projectMatches(p, projectsViewState); });
    if (!filtered.length) {
      list.innerHTML = '<p class="log-empty">No projects match your search/filter.</p>';
      return;
    }
    var projects = sortItems(filtered, projectsViewState.sortKey, projectsViewState.sortDir, projectAccessor);

    if (projectsViewState.mode === 'table') {
      renderProjectsTable(list, projects);
      return;
    }

    projects.forEach(function (project) {
      var card = document.createElement('div');
      card.className = 'project-card';
      card.setAttribute('data-project-id', project.id);
      card.setAttribute('tabindex', '0');
      var metaParts = [];
      if (project.client) metaParts.push(project.client);
      if (project.deadline) metaParts.push('Due ' + shortDate(project.deadline));
      card.innerHTML =
        '<div class="project-card-main">' +
          '<span class="project-card-name">' + escapeHtml(project.name) + '</span>' +
          '<span class="project-card-meta">' + escapeHtml(metaParts.join(' · ')) + '</span>' +
        '</div>' +
        '<div class="project-card-progress"><div class="project-card-progress-fill" style="width:' + (project.progress || 0) + '%"></div></div>' +
        '<span class="status-pill is-' + project.status + '">' + escapeHtml(PROJECT_STATUS_LABELS[project.status] || project.status) + '</span>';
      card.addEventListener('click', function () { openProjectDetail(project.id); });
      list.appendChild(card);
    });
  }

  function renderProjectsTable(list, projects) {
    var wrap = document.createElement('div');
    wrap.className = 'studio-table-wrap';
    wrap.innerHTML =
      '<table class="studio-table"><thead><tr>' +
        '<th data-sort="name">Name</th><th data-sort="client">Client</th><th data-sort="status">Status</th>' +
        '<th data-sort="deadline">Deadline</th><th data-sort="progress">Progress</th>' +
      '</tr></thead><tbody>' +
      projects.map(function (project) {
        return '<tr data-project-id="' + project.id + '">' +
          '<td>' + escapeHtml(project.name) + '</td>' +
          '<td>' + escapeHtml(project.client) + '</td>' +
          '<td><span class="status-pill is-' + project.status + '">' + escapeHtml(PROJECT_STATUS_LABELS[project.status] || project.status) + '</span></td>' +
          '<td>' + shortDate(project.deadline) + '</td>' +
          '<td>' + (project.progress || 0) + '%</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table>';
    list.appendChild(wrap);
    setupSortableTable(wrap.querySelector('table'), projectsViewState, renderProjects);
    wrap.querySelectorAll('tbody tr').forEach(function (tr) {
      tr.addEventListener('click', function () { openProjectDetail(tr.getAttribute('data-project-id')); });
    });
  }

  document.getElementById('projectsSearchInput').addEventListener('input', function (e) {
    projectsViewState.search = e.target.value;
    renderProjects();
  });
  document.getElementById('projectsStatusFilter').addEventListener('change', function (e) {
    projectsViewState.filter = e.target.value;
    renderProjects();
  });
  document.getElementById('projectsViewToggle').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-mode]');
    if (!btn) return;
    projectsViewState.mode = btn.getAttribute('data-mode');
    this.querySelectorAll('button').forEach(function (b) { b.classList.toggle('is-active', b === btn); });
    renderProjects();
  });

  function openProjectDetail(id) {
    currentDetailId = id;
    showView('project-detail');
    renderProjectDetail(id);
  }
  window.openProjectDetail = openProjectDetail;

  function renderProjectDetail(id) {
    var project = findProject(id);
    var panel = document.getElementById('projectDetailPanel');
    if (!project) { panel.innerHTML = ''; return; }

    var statusOptions = PROJECT_STATUSES.map(function (s) {
      return '<option value="' + s + '"' + (s === project.status ? ' selected' : '') + '>' + PROJECT_STATUS_LABELS[s] + '</option>';
    }).join('');

    var phasesHtml = (project.phases || []).map(function (phase) {
      return '<div class="phase-item' + (phase.done ? ' is-done' : '') + '">' +
        '<input type="checkbox" ' + (phase.done ? 'checked' : '') + ' onchange="togglePhase(\'' + project.id + '\',\'' + phase.id + '\')">' +
        '<span class="phase-item-name">' + escapeHtml(phase.name) + '</span>' +
        '<button type="button" class="phase-item-remove" onclick="removePhase(\'' + project.id + '\',\'' + phase.id + '\')">Remove</button>' +
      '</div>';
    }).join('');

    var deliverablesHtml = (project.deliverables || []).map(function (d) {
      return '<div class="phase-item' + (d.done ? ' is-done' : '') + '">' +
        '<input type="checkbox" ' + (d.done ? 'checked' : '') + ' onchange="toggleDeliverable(\'' + project.id + '\',\'' + d.id + '\')">' +
        '<span class="phase-item-name">' + escapeHtml(d.name) + '</span>' +
        '<button type="button" class="phase-item-remove" onclick="removeDeliverable(\'' + project.id + '\',\'' + d.id + '\')">Remove</button>' +
      '</div>';
    }).join('') || '<p class="log-empty">No deliverables listed yet.</p>';

    var totalExpenses = (project.expenses || []).reduce(function (sum, x) { return sum + (parseFloat(x.amount) || 0); }, 0);
    var netAfterExpenses = (parseFloat(project.fee) || 0) - totalExpenses;
    var expensesHtml = lineItemsHtml(project.expenses, project.id, 'expenses');

    var driveLinksHtml = (project.driveLinks || []).map(function (link) {
      return '<div class="drive-link-item"><a href="' + escapeHtml(link.url) + '" target="_blank" rel="noopener">' + escapeHtml(link.label || link.url) + '</a>' +
        '<button type="button" class="line-item-remove" onclick="removeDriveLink(\'' + project.id + '\',\'' + link.id + '\')">Remove</button></div>';
    }).join('') || '<p class="log-empty">No links added yet.</p>';

    var contractStatusOptions = ['draft', 'sent', 'signed'].map(function (s) {
      return '<option value="' + s + '"' + (s === project.contract.status ? ' selected' : '') + '>' + s.charAt(0).toUpperCase() + s.slice(1) + '</option>';
    }).join('');

    var invoiceItemsHtml = lineItemsHtml(project.invoice.items, project.id, 'invoice.items');
    var invoiceSubtotal = (project.invoice.items || []).reduce(function (sum, x) { return sum + (parseFloat(x.amount) || 0); }, 0);
    var invoiceTax = invoiceSubtotal * ((parseFloat(project.invoice.taxPercent) || 0) / 100);
    var invoiceTotal = invoiceSubtotal + invoiceTax;
    var invoiceStatusOptions = ['draft', 'sent', 'paid'].map(function (s) {
      return '<option value="' + s + '"' + (s === project.invoice.status ? ' selected' : '') + '>' + s.charAt(0).toUpperCase() + s.slice(1) + '</option>';
    }).join('');

    var recommendOptions = ['', 'yes', 'no', 'unsure'].map(function (v) {
      var label = v === '' ? '—' : v.charAt(0).toUpperCase() + v.slice(1);
      return '<option value="' + v + '"' + (v === project.review.wouldRecommend ? ' selected' : '') + '>' + label + '</option>';
    }).join('');
    var ratingOptions = ['', '1', '2', '3', '4', '5'].map(function (v) {
      return '<option value="' + v + '"' + (v === String(project.review.rating) ? ' selected' : '') + '>' + (v || '—') + '</option>';
    }).join('');

    var caseStudyStatusOptions = [['not-ready', 'Not ready'], ['ready', 'Ready to publish'], ['published', 'Published']].map(function (pair) {
      return '<option value="' + pair[0] + '"' + (pair[0] === project.caseStudy.status ? ' selected' : '') + '>' + pair[1] + '</option>';
    }).join('');

    panel.innerHTML =
      '<button type="button" class="detail-back" onclick="showView(\'projects\')">&larr; Back to Projects</button>' +
      '<div><p class="eyebrow">Project &middot; ' + project.id + '</p><h1 class="case-title">' + escapeHtml(project.name) + '</h1></div>' +
      '<div class="detail-fields">' +
        field('Name', 'text', 'name', project.name) +
        field('Client', 'text', 'client', project.client) +
        field('Service', 'text', 'service', project.service) +
        field('Fee (₹)', 'text', 'fee', project.fee) +
        field('Start Date', 'date', 'startDate', project.startDate) +
        field('Deadline', 'date', 'deadline', project.deadline) +
        '<div class="detail-field"><label>Status</label><select onchange="updateProjectField(\'' + project.id + '\',\'status\',this.value)">' + statusOptions + '</select></div>' +
      '</div>' +
      '<div class="detail-field"><label>Notes</label><textarea rows="3" onchange="updateProjectField(\'' + project.id + '\',\'notes\',this.value)">' + escapeHtml(project.notes) + '</textarea></div>' +

      '<details class="detail-disclosure" open><summary>Deliverables</summary>' +
        '<div class="phase-list">' + deliverablesHtml + '</div>' +
        '<form class="phase-add" onsubmit="return addDeliverable(event,\'' + project.id + '\')">' +
          '<input type="text" class="new-deliverable-input" placeholder="Add a deliverable… (e.g. Final storyboard PDF)" required>' +
          '<button type="submit" class="pill-btn pill-btn-outline">Add</button>' +
        '</form>' +
      '</details>' +

      '<details class="detail-disclosure" open><summary>Plan Phases</summary>' +
        '<div class="phase-progress-bar"><div class="phase-progress-fill" style="width:' + (project.progress || 0) + '%"></div></div>' +
        '<div class="phase-list">' + phasesHtml + '</div>' +
        '<form class="phase-add" onsubmit="return addPhase(event,\'' + project.id + '\')">' +
          '<input type="text" id="newPhaseInput" placeholder="Add a phase… (e.g. Storyboard)" required>' +
          '<button type="submit" class="pill-btn pill-btn-outline">Add</button>' +
        '</form>' +
      '</details>' +

      '<details class="detail-disclosure"><summary>Budget &amp; Expenses</summary>' +
        expensesHtml +
        '<form class="line-item-add" onsubmit="return addLineItem(event,\'' + project.id + '\',\'expenses\')">' +
          '<input type="text" class="new-item-desc" placeholder="Expense description" required>' +
          '<input type="number" class="new-item-amount" placeholder="Amount" step="0.01" required>' +
          '<button type="submit" class="pill-btn pill-btn-outline">Add</button>' +
        '</form>' +
        '<div class="line-item-total"><span>Total Expenses</span><span>₹' + totalExpenses.toFixed(2) + '</span></div>' +
        '<div class="line-item-total"><span>Net (Fee − Expenses)</span><span>₹' + netAfterExpenses.toFixed(2) + '</span></div>' +
      '</details>' +

      '<details class="detail-disclosure"><summary>Drive Links</summary>' +
        driveLinksHtml +
        '<form class="line-item-add" onsubmit="return addDriveLink(event,\'' + project.id + '\')">' +
          '<input type="text" class="new-link-label" placeholder="Label (e.g. Reference folder)" required>' +
          '<input type="text" class="new-link-url" placeholder="https://drive.google.com/…" required>' +
          '<button type="submit" class="pill-btn pill-btn-outline">Add</button>' +
        '</form>' +
      '</details>' +

      '<details class="detail-disclosure"><summary>Contract</summary>' +
        '<div class="detail-field"><label>Scope</label><textarea rows="3" onchange="updateContractField(\'' + project.id + '\',\'scope\',this.value)">' + escapeHtml(project.contract.scope) + '</textarea></div>' +
        '<div class="detail-field"><label>Terms</label><textarea rows="3" onchange="updateContractField(\'' + project.id + '\',\'terms\',this.value)">' + escapeHtml(project.contract.terms) + '</textarea></div>' +
        '<div class="detail-field"><label>Payment Schedule</label><textarea rows="2" onchange="updateContractField(\'' + project.id + '\',\'paymentSchedule\',this.value)">' + escapeHtml(project.contract.paymentSchedule) + '</textarea></div>' +
        '<div class="detail-field"><label>Notes</label><textarea rows="2" onchange="updateContractField(\'' + project.id + '\',\'notes\',this.value)">' + escapeHtml(project.contract.notes) + '</textarea></div>' +
        '<div class="detail-field"><label>Status</label><select onchange="updateContractField(\'' + project.id + '\',\'status\',this.value)">' + contractStatusOptions + '</select></div>' +
      '</details>' +

      '<details class="detail-disclosure"><summary>Invoice</summary>' +
        invoiceItemsHtml +
        '<form class="line-item-add" onsubmit="return addLineItem(event,\'' + project.id + '\',\'invoice.items\')">' +
          '<input type="text" class="new-item-desc" placeholder="Item description" required>' +
          '<input type="number" class="new-item-amount" placeholder="Amount" step="0.01" required>' +
          '<button type="submit" class="pill-btn pill-btn-outline">Add</button>' +
        '</form>' +
        '<div class="detail-field"><label>Tax %</label><input type="number" step="0.01" value="' + escapeHtml(project.invoice.taxPercent) + '" onchange="updateInvoiceField(\'' + project.id + '\',\'taxPercent\',this.value)"></div>' +
        '<div class="line-item-total"><span>Subtotal</span><span>₹' + invoiceSubtotal.toFixed(2) + '</span></div>' +
        '<div class="line-item-total"><span>Tax</span><span>₹' + invoiceTax.toFixed(2) + '</span></div>' +
        '<div class="line-item-total"><span>Total</span><span>₹' + invoiceTotal.toFixed(2) + '</span></div>' +
        '<div class="detail-field"><label>Status</label><select onchange="updateInvoiceField(\'' + project.id + '\',\'status\',this.value)">' + invoiceStatusOptions + '</select></div>' +
        '<div class="detail-field"><label>Issued Date</label><input type="date" value="' + escapeHtml(project.invoice.issuedDate) + '" onchange="updateInvoiceField(\'' + project.id + '\',\'issuedDate\',this.value)"></div>' +
      '</details>' +

      renderActivityLog('project', project.id) +

      '<details class="detail-disclosure"><summary>Review &amp; Feedback</summary>' +
        '<div class="detail-field"><label>Rating (1–5)</label><select onchange="updateReviewField(\'' + project.id + '\',\'rating\',this.value)">' + ratingOptions + '</select></div>' +
        '<div class="detail-field"><label>Would client recommend?</label><select onchange="updateReviewField(\'' + project.id + '\',\'wouldRecommend\',this.value)">' + recommendOptions + '</select></div>' +
        '<div class="detail-field"><label>Testimonial</label><textarea rows="3" onchange="updateReviewField(\'' + project.id + '\',\'testimonial\',this.value)">' + escapeHtml(project.review.testimonial) + '</textarea></div>' +
        '<div class="detail-field"><label>Notes</label><textarea rows="2" onchange="updateReviewField(\'' + project.id + '\',\'notes\',this.value)">' + escapeHtml(project.review.notes) + '</textarea></div>' +
      '</details>' +

      '<details class="detail-disclosure"><summary>Case Study</summary>' +
        '<div class="detail-field"><label>Status</label><select onchange="updateCaseStudyField(\'' + project.id + '\',\'status\',this.value)">' + caseStudyStatusOptions + '</select></div>' +
        '<div class="detail-field"><label>Summary (challenge / process / result)</label><textarea rows="4" onchange="updateCaseStudyField(\'' + project.id + '\',\'summary\',this.value)">' + escapeHtml(project.caseStudy.summary) + '</textarea></div>' +
      '</details>' +

      '<div class="detail-actions">' +
        (project.status !== 'completed' ? '<button type="button" class="pill-btn" onclick="markProjectComplete(\'' + project.id + '\')">Mark Complete</button>' : '') +
        '<button type="button" class="log-entry-delete" onclick="deleteProject(\'' + project.id + '\')">Delete project</button>' +
      '</div>';

    function field(label, type, key, value) {
      return '<div class="detail-field"><label>' + label + '</label><input type="' + type + '" value="' + escapeHtml(value) + '" onchange="updateProjectField(\'' + project.id + '\',\'' + key + '\',this.value)"></div>';
    }
  }

  // Shared renderer for "description + amount" line-item lists (Expenses, Invoice items)
  function lineItemsHtml(items, projectId, listKey) {
    if (!items || !items.length) return '<p class="log-empty">No items yet.</p>';
    return items.map(function (item) {
      return '<div class="line-item-row">' +
        '<input type="text" value="' + escapeHtml(item.description) + '" readonly>' +
        '<input type="number" value="' + escapeHtml(item.amount) + '" readonly>' +
        '<button type="button" class="line-item-remove" onclick="removeLineItem(\'' + projectId + '\',\'' + listKey + '\',\'' + item.id + '\')">Remove</button>' +
      '</div>';
    }).join('');
  }

  function getLineItemArray(project, listKey) {
    if (listKey === 'expenses') return project.expenses;
    if (listKey === 'invoice.items') return project.invoice.items;
    return null;
  }

  window.updateProjectField = function (id, key, value) {
    var project = findProject(id);
    if (!project) return;
    project[key] = value;
    saveLocalState();
    scheduleSync();
  };

  window.deleteProject = function (id) {
    if (!window.confirm('Delete this project? Its log entries will also be removed.')) return;
    state.projects = state.projects.filter(function (p) { return p.id !== id; });
    state.logs = state.logs.filter(function (l) { return !(l.entityType === 'project' && l.entityId === id); });
    saveLocalState();
    scheduleSync();
    window.showView('projects');
  };

  window.addPhase = function (e, projectId) {
    e.preventDefault();
    var input = document.getElementById('newPhaseInput');
    var name = input.value.trim();
    if (!name) return false;
    var project = findProject(projectId);
    if (!project) return false;
    if (!project.phases) project.phases = [];
    project.phases.push({ id: 'PH-' + Date.now(), name: name, done: false });
    recalcProgress(project);
    saveLocalState();
    scheduleSync();
    renderProjectDetail(projectId);
    return false;
  };

  window.togglePhase = function (projectId, phaseId) {
    var project = findProject(projectId);
    if (!project) return;
    var phase = (project.phases || []).filter(function (p) { return p.id === phaseId; })[0];
    if (!phase) return;
    phase.done = !phase.done;
    recalcProgress(project);
    saveLocalState();
    scheduleSync();
    renderProjectDetail(projectId);
  };

  window.removePhase = function (projectId, phaseId) {
    var project = findProject(projectId);
    if (!project) return;
    project.phases = (project.phases || []).filter(function (p) { return p.id !== phaseId; });
    recalcProgress(project);
    saveLocalState();
    scheduleSync();
    renderProjectDetail(projectId);
  };

  window.addDeliverable = function (e, projectId) {
    e.preventDefault();
    var input = e.target.querySelector('.new-deliverable-input');
    var name = input.value.trim();
    if (!name) return false;
    var project = findProject(projectId);
    if (!project) return false;
    if (!project.deliverables) project.deliverables = [];
    project.deliverables.push({ id: 'DEL-' + Date.now(), name: name, done: false });
    saveLocalState();
    scheduleSync();
    renderProjectDetail(projectId);
    return false;
  };

  window.toggleDeliverable = function (projectId, deliverableId) {
    var project = findProject(projectId);
    if (!project) return;
    var d = (project.deliverables || []).filter(function (x) { return x.id === deliverableId; })[0];
    if (!d) return;
    d.done = !d.done;
    saveLocalState();
    scheduleSync();
    renderProjectDetail(projectId);
  };

  window.removeDeliverable = function (projectId, deliverableId) {
    var project = findProject(projectId);
    if (!project) return;
    project.deliverables = (project.deliverables || []).filter(function (x) { return x.id !== deliverableId; });
    saveLocalState();
    scheduleSync();
    renderProjectDetail(projectId);
  };

  window.addLineItem = function (e, projectId, listKey) {
    e.preventDefault();
    var form = e.target;
    var descInput = form.querySelector('.new-item-desc');
    var amountInput = form.querySelector('.new-item-amount');
    var description = descInput.value.trim();
    var amount = amountInput.value;
    if (!description || amount === '') return false;
    var project = findProject(projectId);
    if (!project) return false;
    var arr = getLineItemArray(project, listKey);
    if (!arr) return false;
    arr.push({ id: 'ITEM-' + Date.now(), description: description, amount: amount });
    saveLocalState();
    scheduleSync();
    renderProjectDetail(projectId);
    return false;
  };

  window.removeLineItem = function (projectId, listKey, itemId) {
    var project = findProject(projectId);
    if (!project) return;
    if (listKey === 'expenses') {
      project.expenses = project.expenses.filter(function (x) { return x.id !== itemId; });
    } else if (listKey === 'invoice.items') {
      project.invoice.items = project.invoice.items.filter(function (x) { return x.id !== itemId; });
    }
    saveLocalState();
    scheduleSync();
    renderProjectDetail(projectId);
  };

  window.addDriveLink = function (e, projectId) {
    e.preventDefault();
    var form = e.target;
    var labelInput = form.querySelector('.new-link-label');
    var urlInput = form.querySelector('.new-link-url');
    var label = labelInput.value.trim();
    var url = urlInput.value.trim();
    if (!url) return false;
    var project = findProject(projectId);
    if (!project) return false;
    if (!project.driveLinks) project.driveLinks = [];
    project.driveLinks.push({ id: 'LINK-' + Date.now(), label: label, url: url });
    saveLocalState();
    scheduleSync();
    renderProjectDetail(projectId);
    return false;
  };

  window.removeDriveLink = function (projectId, linkId) {
    var project = findProject(projectId);
    if (!project) return;
    project.driveLinks = (project.driveLinks || []).filter(function (x) { return x.id !== linkId; });
    saveLocalState();
    scheduleSync();
    renderProjectDetail(projectId);
  };

  window.updateContractField = function (projectId, key, value) {
    var project = findProject(projectId);
    if (!project) return;
    project.contract[key] = value;
    saveLocalState();
    scheduleSync();
  };

  window.updateInvoiceField = function (projectId, key, value) {
    var project = findProject(projectId);
    if (!project) return;
    project.invoice[key] = value;
    saveLocalState();
    scheduleSync();
    if (key === 'taxPercent') renderProjectDetail(projectId);
  };

  window.updateReviewField = function (projectId, key, value) {
    var project = findProject(projectId);
    if (!project) return;
    project.review[key] = value;
    saveLocalState();
    scheduleSync();
  };

  window.updateCaseStudyField = function (projectId, key, value) {
    var project = findProject(projectId);
    if (!project) return;
    project.caseStudy[key] = value;
    saveLocalState();
    scheduleSync();
  };

  window.markProjectComplete = function (projectId) {
    var project = findProject(projectId);
    if (!project) return;
    project.status = 'completed';
    project.completed = true;
    (project.phases || []).forEach(function (p) { p.done = true; });
    recalcProgress(project);
    saveLocalState();
    scheduleSync();
    renderProjectDetail(projectId);
  };

  // ---------------------------------------------------------------------
  // Timeline
  // ---------------------------------------------------------------------

  function renderTimeline() {
    var body = document.getElementById('timelineBody');
    var projects = state.projects.filter(function (p) { return p.startDate && p.deadline; });
    if (!projects.length) {
      body.innerHTML = '<p class="log-empty">No project dates yet — set a Start Date and Deadline on a project to see it here.</p>';
      return;
    }
    var starts = projects.map(function (p) { return new Date(p.startDate).getTime(); });
    var ends = projects.map(function (p) { return new Date(p.deadline).getTime(); });
    var minDate = Math.min.apply(null, starts);
    var maxDate = Math.max.apply(null, ends);
    var span = Math.max(maxDate - minDate, 24 * 60 * 60 * 1000);

    var rowsHtml = projects.slice().sort(function (a, b) {
      return new Date(a.startDate) - new Date(b.startDate);
    }).map(function (project) {
      var start = new Date(project.startDate).getTime();
      var end = new Date(project.deadline).getTime();
      var left = ((start - minDate) / span) * 100;
      var width = Math.max(((end - start) / span) * 100, 1.5);
      return '<div class="timeline-row">' +
        '<div class="timeline-row-label">' + escapeHtml(project.name) + '</div>' +
        '<div class="timeline-track">' +
          '<button type="button" class="timeline-bar' + (project.status === 'completed' ? ' is-completed' : '') + '" style="left:' + left + '%;width:' + width + '%" onclick="openProjectDetail(\'' + project.id + '\')" title="' + escapeHtml(project.name) + '"></button>' +
        '</div>' +
      '</div>';
    }).join('');

    body.innerHTML =
      '<div class="timeline-scale"><span>' + shortDate(new Date(minDate).toISOString()) + '</span><span>' + shortDate(new Date(maxDate).toISOString()) + '</span></div>' +
      rowsHtml;
  }

  // ---------------------------------------------------------------------
  // Contacts
  // ---------------------------------------------------------------------

  function contactAccessor(contact, key) {
    if (key === 'name') return (contact.name || '').toLowerCase();
    if (key === 'company') return (contact.company || '').toLowerCase();
    if (key === 'category') return contact.category || '';
    return (contact.name || '').toLowerCase();
  }

  function contactMatches(contact, vs) {
    if (vs.filter !== 'all' && contact.category !== vs.filter) return false;
    var q = vs.search.trim().toLowerCase();
    if (!q) return true;
    var hay = [contact.name, contact.company, contact.notes, (contact.tags || []).join(' ')].join(' ').toLowerCase();
    return hay.indexOf(q) !== -1;
  }

  function renderContacts() {
    var list = document.getElementById('contactsList');
    list.innerHTML = '';
    if (!state.contacts.length) {
      list.innerHTML = '<p class="log-empty">No contacts yet — add people worth going back to for future work.</p>';
      return;
    }
    var filtered = state.contacts.filter(function (c) { return contactMatches(c, contactsViewState); });
    if (!filtered.length) {
      list.innerHTML = '<p class="log-empty">No contacts match your search/filter.</p>';
      return;
    }
    var contacts = sortItems(filtered, contactsViewState.sortKey, contactsViewState.sortDir, contactAccessor);

    if (contactsViewState.mode === 'table') {
      renderContactsTable(list, contacts);
      return;
    }

    contacts.forEach(function (contact) {
      var card = document.createElement('div');
      card.className = 'contact-card';
      card.setAttribute('data-contact-id', contact.id);
      card.setAttribute('tabindex', '0');
      var metaParts = [];
      if (contact.company) metaParts.push(contact.company);
      if (contact.email) metaParts.push(contact.email);
      card.innerHTML =
        '<div class="contact-card-main">' +
          '<span class="contact-card-name">' + escapeHtml(contact.name) + '</span>' +
          '<span class="contact-card-meta">' + escapeHtml(metaParts.join(' · ')) + '</span>' +
          tagChipsHtml(contact.tags) +
        '</div>' +
        (contact.category ? '<span class="status-pill">' + escapeHtml(CONTACT_CATEGORY_LABELS[contact.category] || contact.category) + '</span>' : '');
      card.addEventListener('click', function () { openContactDetail(contact.id); });
      list.appendChild(card);
    });
  }

  function renderContactsTable(list, contacts) {
    var wrap = document.createElement('div');
    wrap.className = 'studio-table-wrap';
    wrap.innerHTML =
      '<table class="studio-table"><thead><tr>' +
        '<th data-sort="name">Name</th><th data-sort="company">Company</th><th data-sort="category">Category</th>' +
        '<th>Phone / Email</th><th>Tags</th>' +
      '</tr></thead><tbody>' +
      contacts.map(function (contact) {
        return '<tr data-contact-id="' + contact.id + '">' +
          '<td>' + escapeHtml(contact.name) + '</td>' +
          '<td>' + escapeHtml(contact.company) + '</td>' +
          '<td>' + escapeHtml(CONTACT_CATEGORY_LABELS[contact.category] || '') + '</td>' +
          '<td>' + escapeHtml([contact.phone, contact.email].filter(Boolean).join(' / ')) + '</td>' +
          '<td>' + tagChipsHtml(contact.tags) + '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table>';
    list.appendChild(wrap);
    setupSortableTable(wrap.querySelector('table'), contactsViewState, renderContacts);
    wrap.querySelectorAll('tbody tr').forEach(function (tr) {
      tr.addEventListener('click', function () { openContactDetail(tr.getAttribute('data-contact-id')); });
    });
  }

  document.getElementById('contactsSearchInput').addEventListener('input', function (e) {
    contactsViewState.search = e.target.value;
    renderContacts();
  });
  document.getElementById('contactsCategoryFilter').addEventListener('change', function (e) {
    contactsViewState.filter = e.target.value;
    renderContacts();
  });
  document.getElementById('contactsViewToggle').addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-mode]');
    if (!btn) return;
    contactsViewState.mode = btn.getAttribute('data-mode');
    this.querySelectorAll('button').forEach(function (b) { b.classList.toggle('is-active', b === btn); });
    renderContacts();
  });

  document.getElementById('contactQuickForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var input = document.getElementById('contactQuickInput');
    var name = input.value.trim();
    if (!name) return;
    var contact = normalizeContact({ id: genId('contact'), name: name });
    state.contacts.push(contact);
    saveLocalState();
    scheduleSync();
    renderContacts();
    input.value = '';
    input.style.height = '';
    input.focus();
  });

  document.getElementById('contactQuickInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('contactQuickForm').requestSubmit();
    }
  });

  function openContactDetail(id) {
    currentDetailId = id;
    showView('contact-detail');
    renderContactDetail(id);
  }
  window.openContactDetail = openContactDetail;

  function renderContactDetail(id) {
    var contact = findContact(id);
    var panel = document.getElementById('contactDetailPanel');
    if (!contact) { panel.innerHTML = ''; return; }

    var categoryOptions = '<option value="">—</option>' + CONTACT_CATEGORIES.map(function (c) {
      return '<option value="' + c + '"' + (c === contact.category ? ' selected' : '') + '>' + CONTACT_CATEGORY_LABELS[c] + '</option>';
    }).join('');

    var relatedLeads = state.leads.filter(function (l) { return l.contactId === contact.id; });
    var relatedHtml = relatedLeads.length
      ? '<div class="related-leads-list">' + relatedLeads.map(function (l) {
          return '<div class="related-lead-item" onclick="openLeadDetail(\'' + l.id + '\')"><span>' + escapeHtml(l.name) + '</span><span class="status-pill is-' + l.status + '">' + escapeHtml(LEAD_STATUS_LABELS[l.status] || l.status) + '</span></div>';
        }).join('') + '</div>'
      : '<p class="log-empty">No leads referred by this contact yet.</p>';

    panel.innerHTML =
      '<button type="button" class="detail-back" onclick="showView(\'contacts\')">&larr; Back to Contacts</button>' +
      '<div><p class="eyebrow">Contact</p><h1 class="case-title">' + escapeHtml(contact.name) + '</h1></div>' +
      '<div class="detail-fields">' +
        field('Name', 'text', 'name', contact.name) +
        field('Company', 'text', 'company', contact.company) +
        '<div class="detail-field"><label>Category</label><select onchange="updateContactField(\'' + contact.id + '\',\'category\',this.value)">' + categoryOptions + '</select></div>' +
        field('Phone', 'text', 'phone', contact.phone) +
        field('Email', 'text', 'email', contact.email) +
        field('Website', 'text', 'website', contact.website) +
        field('Instagram', 'text', 'instagram', contact.instagram) +
        field('LinkedIn', 'text', 'linkedin', contact.linkedin) +
        field('Tags (comma-separated)', 'text', 'tagsRaw', contact.tags.join(', ')) +
      '</div>' +
      '<div class="detail-field"><label>Notes</label><textarea rows="3" onchange="updateContactField(\'' + contact.id + '\',\'notes\',this.value)">' + escapeHtml(contact.notes) + '</textarea></div>' +
      '<div class="detail-section"><h3>Related Leads</h3>' + relatedHtml + '</div>' +
      renderActivityLog('contact', contact.id) +
      '<div class="detail-actions"><button type="button" class="log-entry-delete" onclick="deleteContact(\'' + contact.id + '\')">Delete contact</button></div>';

    function field(label, type, key, value) {
      return '<div class="detail-field"><label>' + label + '</label><input type="' + type + '" value="' + escapeHtml(value) + '" onchange="updateContactField(\'' + contact.id + '\',\'' + key + '\',this.value)"></div>';
    }
  }

  window.updateContactField = function (id, key, value) {
    var contact = findContact(id);
    if (!contact) return;
    if (key === 'tagsRaw') {
      contact.tags = parseTags(value);
    } else {
      contact[key] = value;
    }
    saveLocalState();
    scheduleSync();
  };

  window.deleteContact = function (id) {
    if (!window.confirm('Delete this contact?')) return;
    state.contacts = state.contacts.filter(function (c) { return c.id !== id; });
    state.logs = state.logs.filter(function (l) { return !(l.entityType === 'contact' && l.entityId === id); });
    saveLocalState();
    scheduleSync();
    window.showView('contacts');
  };

  // ---------------------------------------------------------------------
  // Auto-grow textareas (compose bars)
  // ---------------------------------------------------------------------

  document.addEventListener('input', function (e) {
    if (e.target.matches('.log-quick-bar textarea')) {
      e.target.style.height = 'auto';
      e.target.style.height = e.target.scrollHeight + 'px';
    }
  });

  // ---------------------------------------------------------------------
  // Gate / unlock / logout
  // ---------------------------------------------------------------------

  function renderAll() {
    renderLeads();
    renderProjects();
    renderTimeline();
    renderContacts();
  }

  function unlockOs(secret, fetchedState) {
    currentSecret = secret;
    state = fetchedState;
    saveLocalState();
    osGate.hidden = true;
    osApp.hidden = false;
    osLogoutBtn.hidden = false;
    showView('leads');
    renderAll();
  }

  osGateForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var attempted = osGatePassword.value;
    osGateError.hidden = true;
    fetchState(attempted)
      .then(function (fetched) {
        osGatePassword.value = '';
        unlockOs(attempted, fetched);
        try { localStorage.setItem(SECRET_KEY, attempted); } catch (e) { /* ignore */ }
        setSyncStatus('synced', 'Synced');
      })
      .catch(function (err) {
        if (err && err.unauthorized) {
          osGateError.textContent = 'Incorrect password.';
        } else {
          osGateError.textContent = "Couldn't reach the server — check your connection and try again.";
        }
        osGateError.hidden = false;
      });
  });

  osLogoutBtn.addEventListener('click', function () {
    try { localStorage.removeItem(SECRET_KEY); } catch (e) { /* ignore */ }
    location.reload();
  });

  function refreshFromServer() {
    if (!currentSecret) return;
    setSyncStatus('saving', 'Refreshing…');
    fetchState(currentSecret)
      .then(function (fetched) {
        state = fetched;
        saveLocalState();
        if (currentView === 'lead-detail' && currentDetailId) renderLeadDetail(currentDetailId);
        else if (currentView === 'project-detail' && currentDetailId) renderProjectDetail(currentDetailId);
        else if (currentView === 'contact-detail' && currentDetailId) renderContactDetail(currentDetailId);
        else if (currentView === 'leads') renderLeads();
        else if (currentView === 'projects') renderProjects();
        else if (currentView === 'timeline') renderTimeline();
        else if (currentView === 'contacts') renderContacts();
        setSyncStatus('synced', 'Synced');
      })
      .catch(function () {
        setSyncStatus('error', 'Refresh failed — showing last loaded copy');
      });
  }

  osRefreshBtn.addEventListener('click', refreshFromServer);

  var cachedSecret = null;
  try { cachedSecret = localStorage.getItem(SECRET_KEY); } catch (e) { /* ignore */ }

  if (cachedSecret) {
    fetchState(cachedSecret)
      .then(function (fetched) {
        unlockOs(cachedSecret, fetched);
        setSyncStatus('synced', 'Synced');
      })
      .catch(function (err) {
        if (err && err.unauthorized) {
          try { localStorage.removeItem(SECRET_KEY); } catch (e2) { /* ignore */ }
          return;
        }
        var local = getLocalState();
        unlockOs(cachedSecret, local || cloneEmptyState());
        setSyncStatus('error', 'Offline — showing last saved copy');
      });
  }
})();
