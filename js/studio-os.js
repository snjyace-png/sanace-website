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
  var currentLeadId = null;
  var currentProjectId = null;
  var currentContactId = null;
  var syncTimer = null;

  var osGate = document.getElementById('osGate');
  var osGateForm = document.getElementById('osGateForm');
  var osGatePassword = document.getElementById('osGatePassword');
  var osGateError = document.getElementById('osGateError');
  var osApp = document.getElementById('osApp');
  var osLogoutBtn = document.getElementById('osLogoutBtn');
  var osSyncStatus = document.getElementById('osSyncStatus');
  var osNav = document.getElementById('osNav');

  function cloneEmptyState() {
    return JSON.parse(JSON.stringify(EMPTY_STATE));
  }

  function normalizeState(raw) {
    var s = raw && typeof raw === 'object' ? raw : {};
    return {
      leads: Array.isArray(s.leads) ? s.leads : [],
      projects: Array.isArray(s.projects) ? s.projects : [],
      logs: Array.isArray(s.logs) ? s.logs : [],
      contacts: Array.isArray(s.contacts) ? s.contacts : [],
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
  function logsForProject(id) {
    return state.logs.filter(function (l) { return l.projectId === id; })
      .slice().sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
  }

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
    var view = btn.getAttribute('data-view');
    showView(view);
    if (view === 'leads') renderLeads();
    if (view === 'projects') renderProjects();
    if (view === 'timeline') renderTimeline();
    if (view === 'contacts') renderContacts();
  });

  window.showView = function (name) {
    showView(name);
    if (name === 'leads') renderLeads();
    if (name === 'projects') renderProjects();
    if (name === 'timeline') renderTimeline();
    if (name === 'contacts') renderContacts();
  };

  // ---------------------------------------------------------------------
  // Leads
  // ---------------------------------------------------------------------

  var LEAD_STATUSES = ['new', 'contacted', 'discussion', 'confirmed', 'converted', 'lost', 'on-hold'];
  var LEAD_STATUS_LABELS = {
    'new': 'New', 'contacted': 'Contacted', 'discussion': 'Discussion',
    'confirmed': 'Confirmed', 'converted': 'Converted', 'lost': 'Lost', 'on-hold': 'On Hold'
  };

  function renderLeads() {
    var list = document.getElementById('leadsList');
    list.innerHTML = '';
    if (!state.leads.length) {
      list.innerHTML = '<p class="log-empty">No leads yet — jot one down above.</p>';
      return;
    }
    var leads = state.leads.slice().reverse();
    leads.forEach(function (lead) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'lead-card';
      var metaParts = [];
      if (lead.service) metaParts.push(lead.service);
      if (lead.estimatedFee) metaParts.push('₹' + lead.estimatedFee);
      if (lead.nextFollowUp) metaParts.push('Follow up ' + shortDate(lead.nextFollowUp));
      card.innerHTML =
        '<div class="lead-card-main">' +
          '<span class="lead-card-name">' + escapeHtml(lead.name) + '</span>' +
          '<span class="lead-card-meta">' + escapeHtml(metaParts.join(' · ')) + '</span>' +
        '</div>' +
        '<span class="status-pill is-' + lead.status + '">' + escapeHtml(LEAD_STATUS_LABELS[lead.status] || lead.status) + '</span>';
      card.addEventListener('click', function () { openLeadDetail(lead.id); });
      list.appendChild(card);
    });
  }

  document.getElementById('leadQuickForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var input = document.getElementById('leadQuickInput');
    var name = input.value.trim();
    if (!name) return;
    var lead = {
      id: genId('lead'),
      date: new Date().toISOString(),
      name: name,
      service: '',
      brief: '',
      estimatedFee: '',
      timing: '',
      status: 'new',
      nextFollowUp: '',
      notes: '',
      projectId: null,
      convertedDate: null,
      contactId: null,
      source: ''
    };
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
    currentLeadId = id;
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
        '<div class="detail-field contact-picker">' +
          '<label>Referred by</label>' +
          '<input type="text" id="leadContactInput" value="' + escapeHtml(contactDisplay) + '" placeholder="Type a name or contact…" oninput="onLeadContactInput(\'' + lead.id + '\', this.value)" onblur="setTimeout(function(){var r=document.getElementById(\'leadContactResults\'); if(r) r.hidden=true;},150)">' +
          '<div class="contact-picker-results" id="leadContactResults" hidden></div>' +
        '</div>' +
      '</div>' +
      '<div class="detail-field"><label>Brief</label><textarea rows="3" onchange="updateLeadField(\'' + lead.id + '\',\'brief\',this.value)">' + escapeHtml(lead.brief) + '</textarea></div>' +
      '<div class="detail-field"><label>Notes</label><textarea rows="3" onchange="updateLeadField(\'' + lead.id + '\',\'notes\',this.value)">' + escapeHtml(lead.notes) + '</textarea></div>' +
      '<div class="detail-actions">' + actions + '</div>';

    function field(label, type, key, value) {
      return '<div class="detail-field"><label>' + label + '</label><input type="' + type + '" value="' + escapeHtml(value) + '" onchange="updateLeadField(\'' + lead.id + '\',\'' + key + '\',this.value)"></div>';
    }
  }

  window.updateLeadField = function (id, key, value) {
    var lead = findLead(id);
    if (!lead) return;
    lead[key] = value;
    saveLocalState();
    scheduleSync();
    if (key === 'status') renderLeadDetail(id);
  };

  window.deleteLead = function (id) {
    if (!window.confirm('Delete this lead?')) return;
    state.leads = state.leads.filter(function (l) { return l.id !== id; });
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
    var project = {
      id: genId('project'),
      leadId: lead.id,
      name: lead.name,
      service: lead.service,
      client: lead.name,
      startDate: '',
      deadline: '',
      status: 'not-started',
      completed: false,
      progress: 0,
      fee: lead.estimatedFee,
      notes: lead.brief,
      phases: []
    };
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

  var PROJECT_STATUSES = ['not-started', 'active', 'waiting', 'on-hold', 'completed'];
  var PROJECT_STATUS_LABELS = {
    'not-started': 'Not Started', 'active': 'Active', 'waiting': 'Waiting',
    'on-hold': 'On Hold', 'completed': 'Completed'
  };

  function recalcProgress(project) {
    if (!project.phases || !project.phases.length) {
      project.progress = project.completed ? 100 : 0;
      return;
    }
    var done = project.phases.filter(function (p) { return p.done; }).length;
    project.progress = Math.round((done / project.phases.length) * 100);
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
    var projects = state.projects.slice().reverse();
    projects.forEach(function (project) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'project-card';
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

  function openProjectDetail(id) {
    currentProjectId = id;
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

    var logsHtml = logsForProject(project.id).map(function (log) {
      return '<div class="log-feed-item">' +
        '<div class="log-feed-item-meta"><span class="log-feed-item-type">' + escapeHtml(log.type) + '</span><span>' + shortDate(log.date) + '</span></div>' +
        '<div class="log-feed-item-note">' + escapeHtml(log.note) + '</div>' +
        (log.nextAction ? '<div class="log-feed-item-next">Next: ' + escapeHtml(log.nextAction) + '</div>' : '') +
      '</div>';
    }).join('') || '<p class="log-empty">No log entries yet.</p>';

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
      '<div class="detail-section">' +
        '<h3>Plan Phases</h3>' +
        '<div class="phase-progress-bar"><div class="phase-progress-fill" style="width:' + (project.progress || 0) + '%"></div></div>' +
        '<div class="phase-list">' + phasesHtml + '</div>' +
        '<form class="phase-add" onsubmit="return addPhase(event,\'' + project.id + '\')">' +
          '<input type="text" id="newPhaseInput" placeholder="Add a phase… (e.g. Storyboard)" required>' +
          '<button type="submit" class="pill-btn pill-btn-outline">Add</button>' +
        '</form>' +
      '</div>' +
      '<div class="detail-section">' +
        '<h3>Project Log</h3>' +
        '<form class="log-quick-bar" onsubmit="return addProjectLog(event,\'' + project.id + '\')">' +
          '<select id="newLogType" style="flex-shrink:0;border-radius:0.6rem;border:1px solid var(--c-border);background-color:var(--c-bg);color:var(--c-text);padding:0.65rem;font-family:var(--font-sans);">' +
            '<option value="note">Note</option><option value="decision">Decision</option><option value="feedback">Feedback</option>' +
            '<option value="milestone">Milestone</option><option value="meeting">Meeting</option><option value="delivery">Delivery</option>' +
          '</select>' +
          '<textarea id="newLogNote" rows="1" placeholder="What happened…" required></textarea>' +
          '<button type="submit" class="pill-btn">Add Log</button>' +
        '</form>' +
        '<div class="log-feed">' + logsHtml + '</div>' +
      '</div>' +
      '<div class="detail-actions">' +
        (project.status !== 'completed' ? '<button type="button" class="pill-btn" onclick="markProjectComplete(\'' + project.id + '\')">Mark Complete</button>' : '') +
        '<button type="button" class="log-entry-delete" onclick="deleteProject(\'' + project.id + '\')">Delete project</button>' +
      '</div>';

    function field(label, type, key, value) {
      return '<div class="detail-field"><label>' + label + '</label><input type="' + type + '" value="' + escapeHtml(value) + '" onchange="updateProjectField(\'' + project.id + '\',\'' + key + '\',this.value)"></div>';
    }
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
    state.logs = state.logs.filter(function (l) { return l.projectId !== id; });
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

  window.addProjectLog = function (e, projectId) {
    e.preventDefault();
    var typeSelect = document.getElementById('newLogType');
    var noteInput = document.getElementById('newLogNote');
    var note = noteInput.value.trim();
    if (!note) return false;
    state.logs.push({
      id: genId('log'),
      date: new Date().toISOString(),
      projectId: projectId,
      type: typeSelect.value,
      note: note,
      decision: '',
      nextAction: '',
      link: ''
    });
    saveLocalState();
    scheduleSync();
    renderProjectDetail(projectId);
    return false;
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

  function renderContacts() {
    var list = document.getElementById('contactsList');
    list.innerHTML = '';
    if (!state.contacts.length) {
      list.innerHTML = '<p class="log-empty">No contacts yet — add people worth going back to for future work.</p>';
      return;
    }
    var contacts = state.contacts.slice().reverse();
    contacts.forEach(function (contact) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'contact-card';
      var metaParts = [];
      if (contact.company) metaParts.push(contact.company);
      if (contact.email) metaParts.push(contact.email);
      card.innerHTML =
        '<div class="contact-card-main">' +
          '<span class="contact-card-name">' + escapeHtml(contact.name) + '</span>' +
          '<span class="contact-card-meta">' + escapeHtml(metaParts.join(' · ')) + '</span>' +
        '</div>';
      card.addEventListener('click', function () { openContactDetail(contact.id); });
      list.appendChild(card);
    });
  }

  document.getElementById('contactQuickForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var input = document.getElementById('contactQuickInput');
    var name = input.value.trim();
    if (!name) return;
    var contact = {
      id: genId('contact'),
      name: name,
      company: '',
      phone: '',
      email: '',
      website: '',
      instagram: '',
      linkedin: '',
      notes: ''
    };
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
    currentContactId = id;
    showView('contact-detail');
    renderContactDetail(id);
  }
  window.openContactDetail = openContactDetail;

  function renderContactDetail(id) {
    var contact = findContact(id);
    var panel = document.getElementById('contactDetailPanel');
    if (!contact) { panel.innerHTML = ''; return; }

    panel.innerHTML =
      '<button type="button" class="detail-back" onclick="showView(\'contacts\')">&larr; Back to Contacts</button>' +
      '<div><p class="eyebrow">Contact</p><h1 class="case-title">' + escapeHtml(contact.name) + '</h1></div>' +
      '<div class="detail-fields">' +
        field('Name', 'text', 'name', contact.name) +
        field('Company', 'text', 'company', contact.company) +
        field('Phone', 'text', 'phone', contact.phone) +
        field('Email', 'text', 'email', contact.email) +
        field('Website', 'text', 'website', contact.website) +
        field('Instagram', 'text', 'instagram', contact.instagram) +
        field('LinkedIn', 'text', 'linkedin', contact.linkedin) +
      '</div>' +
      '<div class="detail-field"><label>Notes</label><textarea rows="3" onchange="updateContactField(\'' + contact.id + '\',\'notes\',this.value)">' + escapeHtml(contact.notes) + '</textarea></div>' +
      '<div class="detail-actions"><button type="button" class="log-entry-delete" onclick="deleteContact(\'' + contact.id + '\')">Delete contact</button></div>';

    function field(label, type, key, value) {
      return '<div class="detail-field"><label>' + label + '</label><input type="' + type + '" value="' + escapeHtml(value) + '" onchange="updateContactField(\'' + contact.id + '\',\'' + key + '\',this.value)"></div>';
    }
  }

  window.updateContactField = function (id, key, value) {
    var contact = findContact(id);
    if (!contact) return;
    contact[key] = value;
    saveLocalState();
    scheduleSync();
  };

  window.deleteContact = function (id) {
    if (!window.confirm('Delete this contact?')) return;
    state.contacts = state.contacts.filter(function (c) { return c.id !== id; });
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
