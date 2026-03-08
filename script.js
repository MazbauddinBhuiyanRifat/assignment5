 const API = 'https://phi-lab-server.vercel.app/api/v1/lab';
  let ALL = [];
  let currentTab = 'all';
  let searchTimer = null;
  let isSearchMode = false;

  // ─── NORMALISE API RESPONSE ──────────────────────────────
  // Unwrap whatever envelope the API returns
  function unwrap(json) {
    if (Array.isArray(json)) return json;
    for (const k of ['issues','data','result','results','items','issue']) {
      if (Array.isArray(json[k])) return json[k];
    }
    return [];
  }

  // ─── STATUS DETECTION ────────────────────────────────────
  // Works for: status:"open"/"closed", isOpen:bool, open:bool, isClosed:bool, state:"open"/"closed"
  function getStatus(issue) {
    // string fields
    const s = String(issue.status || issue.state || '').toLowerCase();
    if (s === 'open')   return 'open';
    if (s === 'closed') return 'closed';
    // boolean fields
    if (typeof issue.isOpen   === 'boolean') return issue.isOpen   ? 'open' : 'closed';
    if (typeof issue.open     === 'boolean') return issue.open     ? 'open' : 'closed';
    if (typeof issue.isClosed === 'boolean') return issue.isClosed ? 'closed' : 'open';
    if (typeof issue.closed   === 'boolean') return issue.closed   ? 'closed' : 'open';
    return 'open'; // fallback
  }

  function getPriority(issue) {
    return String(issue.priority || issue.severity || '').toUpperCase() || null;
  }

  function getLabels(issue) {
    const r = issue.labels || issue.tags || [];
    return Array.isArray(r)
      ? r.map(l => typeof l === 'string' ? l : (l.name || l.label || '')).filter(Boolean)
      : [];
  }

  function getAuthor(issue) {
    return issue.author || issue.createdBy || (issue.user && issue.user.login) || issue.username || 'unknown';
  }

  function getAssignee(issue) {
    return issue.assignee || issue.assignedTo || issue.assigned_to || 'Unassigned';
  }

  function getDate(issue) {
    const d = issue.createdAt || issue.created_at || issue.date || '';
    if (!d) return '';
    try { return new Date(d).toLocaleDateString('en-US', { month:'numeric', day:'numeric', year:'numeric' }); }
    catch { return d; }
  }

  function getId(issue) { return issue._id || issue.id || ''; }
  function getNum(issue, i) { return issue.number || issue.issueNumber || issue.num || (i + 1); }

  // ─── AUTH ────────────────────────────────────────────────
  function doLogin() {
    const u = document.getElementById('inp_user').value.trim();
    const p = document.getElementById('inp_pass').value.trim();
    const err = document.getElementById('loginErr');
    if (u === 'admin' && p === 'admin123') {
      err.classList.add('hidden');
      document.getElementById('loginPage').classList.add('hidden');
      document.getElementById('appPage').classList.remove('hidden');
      fetchAll();
    } else {
      err.textContent = 'Invalid credentials. Use admin / admin123.';
      err.classList.remove('hidden');
    }
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !document.getElementById('loginPage').classList.contains('hidden')) doLogin();
  });

  function doLogout() {
    document.getElementById('appPage').classList.add('hidden');
    document.getElementById('loginPage').classList.remove('hidden');
    ALL = []; currentTab = 'all'; isSearchMode = false;
    document.getElementById('searchInput').value = '';
    setTabActive('all');
  }

  // ─── FETCH ───────────────────────────────────────────────
  async function fetchAll() {
    showLoading();
    try {
      const res = await fetch(`${API}/issues`);
      const json = await res.json();
      ALL = unwrap(json);
      console.log('[API] Total issues:', ALL.length, '| Sample:', ALL[0]);
      render();
    } catch (e) {
      console.error(e);
      showError('Could not reach the API. Check your internet connection.');
    }
  }

  async function fetchDetail(id) {
    if (!id || id.startsWith('local_')) return;
    try {
      const res = await fetch(`${API}/issue/${id}`);
      const json = await res.json();
      // unwrap single issue envelope
      const issue = json.issue || json.data || json.result || json;
      openDetail(Array.isArray(issue) ? issue[0] : issue);
    } catch (e) {
      alert('Could not load issue details.');
    }
  }

  async function doSearch(q) {
    if (!q.trim()) { isSearchMode = false; render(); return; }
    isSearchMode = true;
    showLoading();
    try {
      const res = await fetch(`${API}/issues/search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      const results = unwrap(json);
      renderCards(results);
      setCount(results.length);
    } catch (e) {
      showError('Search failed.');
    }
  }

  // ─── RENDER ──────────────────────────────────────────────
  function render() {
    let list = ALL;
    if (currentTab === 'open')   list = ALL.filter(i => getStatus(i) === 'open');
    if (currentTab === 'closed') list = ALL.filter(i => getStatus(i) === 'closed');
    renderCards(list);
    setCount(list.length);
  }

  function setCount(n) {
    document.getElementById('issueCount').textContent = `${n} Issue${n !== 1 ? 's' : ''}`;
  }

  function renderCards(list) {
    const grid = document.getElementById('grid');
    if (!list.length) {
      grid.innerHTML = `<div class="empty-box">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" fill="none" stroke="#d1d5db" stroke-width="1.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <p class="font-semibold text-gray-400">No issues found</p>
        <p class="text-sm text-gray-300">Try a different filter or create a new issue</p>
      </div>`;
      return;
    }
    grid.innerHTML = list.map((issue, i) => card(issue, i)).join('');
  }

  function card(issue, idx) {
    const status = getStatus(issue);
    const open   = status === 'open';
    const pri    = getPriority(issue);
    const lbls   = getLabels(issue);
    const id     = getId(issue);
    const num    = getNum(issue, idx);
    const dt     = getDate(issue);
    const au     = getAuthor(issue);
    const title  = issue.title || 'Untitled Issue';
    const body   = issue.body || issue.description || 'No description provided.';

    const priClass = pri === 'HIGH' ? 'badge-high' : pri === 'MEDIUM' ? 'badge-medium' : pri === 'LOW' ? 'badge-low' : 'badge-none';

    const statusIcon = open
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="#22c55e" stroke-width="2.5" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" stroke="#8b5cf6" stroke-width="2.5" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`;

    const lblHtml = lbls.slice(0, 3).map(l => {
      const lc  = l.toLowerCase();
      const cls = lc.includes('bug') ? 'lbl-bug' : lc.includes('enhanc') ? 'lbl-enhancement' : lc.includes('help') ? 'lbl-help' : 'lbl-default';
      return `<span class="lbl ${cls}">${l}</span>`;
    }).join('');

    return `<div class="issue-card" style="animation-delay:${idx * 0.03}s" onclick="fetchDetail('${id}')">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-1.5">
          ${statusIcon}
          <span class="text-xs font-semibold ${open ? 'text-green-600' : 'text-purple-600'}">${open ? 'Open' : 'Closed'}</span>
        </div>
        ${pri ? `<span class="text-xs font-bold px-2 py-0.5 rounded-full ${priClass}">${pri}</span>` : ''}
      </div>
      <h3 class="text-sm font-bold text-gray-800 leading-snug mb-1 line-clamp-2">${title}</h3>
      <p class="text-xs text-gray-500 mb-3 line-clamp-2">${body}</p>
      <div class="flex flex-wrap gap-1 mb-3">${lblHtml}</div>
      <div class="border-t border-gray-100 pt-2 text-xs text-gray-400">
        <span class="mono font-semibold">#${num}</span> by <span class="font-semibold text-gray-600">${au}</span>
        ${dt ? `<br>${dt}` : ''}
      </div>
    </div>`;
  }

  function showLoading() {
    document.getElementById('grid').innerHTML = `
      <div style="grid-column:1/-1;display:flex;justify-content:center;padding:60px">
        <span class="loading loading-spinner loading-lg" style="color:#7c3aed"></span>
      </div>`;
  }

  function showError(msg) {
    document.getElementById('grid').innerHTML = `
      <div class="empty-box"><p class="text-red-400 font-semibold text-sm">${msg}</p></div>`;
  }

  // ─── TABS ────────────────────────────────────────────────
  function switchTab(tab) {
    currentTab = tab;
    setTabActive(tab);
    if (!isSearchMode) render();
  }
  function setTabActive(tab) {
    ['all','open','closed'].forEach(t =>
      document.getElementById(`tab-${t}`).classList.toggle('active', t === tab)
    );
  }

  // ─── SEARCH ──────────────────────────────────────────────
  function onSearch(val) {
    clearTimeout(searchTimer);
    if (!val.trim()) { isSearchMode = false; render(); return; }
    searchTimer = setTimeout(() => doSearch(val), 400);
  }

  // ─── DETAIL MODAL ────────────────────────────────────────
  function openDetail(issue) {
    const open = getStatus(issue) === 'open';
    const pri  = getPriority(issue);
    const lbls = getLabels(issue);

    document.getElementById('dm_title').textContent = issue.title || 'Untitled';

    const stEl = document.getElementById('dm_status');
    stEl.textContent = open ? 'Open' : 'Closed';
    stEl.className = `px-2.5 py-0.5 rounded-full font-bold text-xs ${open ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`;

    const dt = getDate(issue);
    document.getElementById('dm_meta').textContent = `Opened by ${getAuthor(issue)}${dt ? ' • ' + dt : ''}`;

    document.getElementById('dm_labels').innerHTML = lbls.map(l => {
      const lc  = l.toLowerCase();
      const cls = lc.includes('bug') ? 'lbl-bug' : lc.includes('enhanc') ? 'lbl-enhancement' : lc.includes('help') ? 'lbl-help' : 'lbl-default';
      return `<span class="lbl ${cls}">${l}</span>`;
    }).join('');

    document.getElementById('dm_body').textContent = issue.body || issue.description || 'No description.';
    document.getElementById('dm_assignee').textContent = getAssignee(issue);

    const priEl = document.getElementById('dm_priority');
    priEl.textContent = pri || '—';
    priEl.className = `text-sm font-bold ${pri === 'HIGH' ? 'text-red-600' : pri === 'MEDIUM' ? 'text-yellow-600' : 'text-green-600'}`;

    document.getElementById('detailModal').classList.remove('hidden');
  }

  function closeDetail() { document.getElementById('detailModal').classList.add('hidden'); }

  
  function openNewModal() {
    ['ni_title','ni_body','ni_assignee','ni_labels'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('ni_priority').value = 'MEDIUM';
    document.getElementById('ni_err').classList.add('hidden');
    document.getElementById('newModal').classList.remove('hidden');
  }
  function closeNewModal() { document.getElementById('newModal').classList.add('hidden'); }

  async function submitNew() {
    const title = document.getElementById('ni_title').value.trim();
    const errEl = document.getElementById('ni_err');
    if (!title) { errEl.textContent = 'Title is required!'; errEl.classList.remove('hidden'); return; }
    errEl.classList.add('hidden');

    const lblArr = document.getElementById('ni_labels').value.split(',').map(s => s.trim()).filter(Boolean);
    const payload = {
      title,
      body: document.getElementById('ni_body').value.trim(),
      priority: document.getElementById('ni_priority').value,
      assignee: document.getElementById('ni_assignee').value.trim() || 'admin',
      labels: lblArr,
      status: 'open'
    };

    const fake = { ...payload, _id: 'local_' + Date.now(), number: ALL.length + 1, createdAt: new Date().toISOString(), author: 'admin' };

    try {
      const res  = await fetch(`${API}/issues`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const json = await res.json();
      const saved = json.issue || json.data || json || {};
      ALL.unshift({ ...fake, ...saved });
    } catch {
      ALL.unshift(fake);
    }

    closeNewModal();
    render();
  }