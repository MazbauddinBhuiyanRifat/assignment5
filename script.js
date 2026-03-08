const API = 'https://phi-lab-server.vercel.app/api/v1/lab';
let ALL = [], currentTab = 'all', searchTimer = null, isSearchMode = false;
const unwrap = json => {
  if (Array.isArray(json)) return json;
  for (const k of ['issues','data','result','results','items','issue'])
    if (Array.isArray(json[k])) return json[k];
  return [];
};
const getStatus = i => {
  const s = String(i.status || i.state || '').toLowerCase();
  if (s === 'open' || s === 'closed') return s;
  if ('isOpen' in i) return i.isOpen   ? 'open' : 'closed';
  if ('open' in i) return i.open     ? 'open' : 'closed';
  if ('isClosed'in i) return i.isClosed ? 'closed' : 'open';
  if ('closed' in i) return i.closed   ? 'closed' : 'open';
  return 'open';
};
const getPriority = i => String(i.priority || i.severity || '').toUpperCase() || null;
const getLabels = i => {
  const r = i.labels || i.tags || [];
  return Array.isArray(r) ? r.map(l => typeof l === 'string' ? l : (l.name || l.label || '')).filter(Boolean) : [];
};
const getAuthor   = i => i.author || i.createdBy || i.user?.login || i.username || 'unknown';
const getAssignee = i => i.assignee || i.assignedTo || i.assigned_to || 'Unassigned';
const getId       = i => i._id || i.id || '';
const getNum      = (i, n) => i.number || i.issueNumber || i.num || (n + 1);

const getDate = i => {
  const d = i.createdAt || i.created_at || i.date || '';
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('en-US', { month:'numeric', day:'numeric', year:'numeric' }); }
  catch { return d; }
};
const el  = id => document.getElementById(id);
const show = id => el(id).classList.remove('hidden');
const hide = id => el(id).classList.add('hidden');
function doLogin() {
  const u = el('inp_user').value.trim();
  const p = el('inp_pass').value.trim();
  if (u === 'admin' && p === 'admin123') {
    hide('loginPage'); show('appPage'); hide('loginErr');
    fetchAll();
  } else {
    el('loginErr').textContent = 'Invalid credentials. Use admin / admin123.';
    show('loginErr');
  }
}
function doLogout() {
  hide('appPage'); show('loginPage');
  ALL = []; currentTab = 'all'; isSearchMode = false;
  el('searchInput').value = '';
  setTabActive('all');
}
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !el('loginPage').classList.contains('hidden')) doLogin();
});
async function fetchAll() {
  showLoading();
  try {
    const json = await fetch(`${API}/issues`).then(r => r.json());
    ALL = unwrap(json);
    console.log('[API] Total:', ALL.length, '| Sample:', ALL[0]);
    render();
  } catch (e) {
    console.error(e);
    showError('Could not reach the API. Check your internet connection.');
  }
}
async function fetchDetail(id) {
  if (!id || id.startsWith('local_')) return;
  try {
    const json  = await fetch(`${API}/issue/${id}`).then(r => r.json());
    const issue = json.issue || json.data || json.result || json;
    openDetail(Array.isArray(issue) ? issue[0] : issue);
  } catch {
    alert('Could not load issue details.');
  }
}
async function doSearch(q) {
  if (!q.trim()) { isSearchMode = false; render(); return; }
  isSearchMode = true;
  showLoading();
  try {
    const json    = await fetch(`${API}/issues/search?q=${encodeURIComponent(q)}`).then(r => r.json());
    const results = unwrap(json);
    renderCards(results);
    setCount(results.length);
  } catch {
    showError('Search failed.');
  }
}
function render() {
  const list = currentTab === 'all' ? ALL
             : ALL.filter(i => getStatus(i) === currentTab);
  renderCards(list);
  setCount(list.length);
}
const setCount = n => el('issueCount').textContent = `${n} Issue${n !== 1 ? 's' : ''}`;
function renderCards(list) {
  if (!list.length) {
    el('grid').innerHTML = `
      <div class="empty-box">
        <i class="fa-regular fa-face-frown" style="font-size:48px; color:#d1d5db;"></i>
        <p class="font-semibold text-gray-400">No issues found</p>
        <p class="text-sm text-gray-300">Try a different filter or create a new issue</p>
      </div>`;
    return;
  }
  el('grid').innerHTML = list.map((issue, i) => card(issue, i)).join('');
}
function card(issue, idx) {
  const open  = getStatus(issue) === 'open';
  const pri   = getPriority(issue);
  const lbls  = getLabels(issue);
  const title = issue.title || 'Untitled Issue';
  const body  = issue.body  || issue.description || 'No description provided.';
  const priClass  = { HIGH:'badge-high', MEDIUM:'badge-medium', LOW:'badge-low' }[pri] ?? 'badge-none';
  const statusIcon = open
    ? `<i class="fa-solid fa-circle-info" style="color:#22c55e; font-size:14px;"></i>`
    : `<i class="fa-solid fa-circle-check" style="color:#8b5cf6; font-size:14px;"></i>`;
  const lblHtml = lbls.slice(0, 3).map(l => {
    const lc  = l.toLowerCase();
    const cls = lc.includes('bug') ? 'lbl-bug' : lc.includes('enhanc') ? 'lbl-enhancement' : lc.includes('help') ? 'lbl-help' : 'lbl-default';
    return `<span class="lbl ${cls}">${l}</span>`;
  }).join('');
  return `
    <div class="issue-card" style="animation-delay:${idx * 0.03}s" onclick="fetchDetail('${getId(issue)}')">
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
        <span class="mono font-semibold">#${getNum(issue, idx)}</span>
        by <span class="font-semibold text-gray-600">${getAuthor(issue)}</span>
        ${getDate(issue) ? `<br>${getDate(issue)}` : ''}
      </div>
    </div>`;
}
const showLoading = () => el('grid').innerHTML = `
  <div style="grid-column:1/-1; display:flex; justify-content:center; padding:60px">
    <span class="loading loading-spinner loading-lg" style="color:#7c3aed"></span>
  </div>`;

const showError = msg => el('grid').innerHTML = `
  <div class="empty-box"><p class="text-red-400 font-semibold text-sm">${msg}</p></div>`;
function switchTab(tab) {
  currentTab = tab;
  setTabActive(tab);
  if (!isSearchMode) render();
}
const setTabActive = tab =>
  ['all','open','closed'].forEach(t =>
    el(`tab-${t}`).classList.toggle('active', t === tab)
  );
function onSearch(val) {
  clearTimeout(searchTimer);
  if (!val.trim()) { isSearchMode = false; render(); return; }
  searchTimer = setTimeout(() => doSearch(val), 400);
}
function openDetail(issue) {
  const open = getStatus(issue) === 'open';
  const pri  = getPriority(issue);
  el('dm_title').textContent = issue.title || 'Untitled'; el('dm_status').textContent = open ? 'Open' : 'Closed';
 
  el('dm_status').className   = `px-2.5 py-0.5 rounded-full font-bold text-xs ${open ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'}`;
  el('dm_meta').textContent   = `Opened by ${getAuthor(issue)}${getDate(issue) ? ' • ' + getDate(issue) : ''}`;
  el('dm_labels').innerHTML = getLabels(issue).map(l => {
    const lc  = l.toLowerCase();
    const cls = lc.includes('bug') ? 'lbl-bug' : lc.includes('enhanc') ? 'lbl-enhancement' : lc.includes('help') ? 'lbl-help' : 'lbl-default';
    return `<span class="lbl ${cls}">${l}</span>`;
  }).join('');

  el('dm_body').textContent     = issue.body || issue.description || 'No description.';
  el('dm_assignee').textContent = getAssignee(issue);

  el('dm_priority').textContent = pri || '—';
  el('dm_priority').className   = `text-sm font-bold ${{ HIGH:'text-red-600', MEDIUM:'text-yellow-600', LOW:'text-green-600' }[pri] ?? ''}`;

  show('detailModal');
}
const closeDetail = () => hide('detailModal');
function openNewModal() {
  ['ni_title','ni_body','ni_assignee','ni_labels'].forEach(id => el(id).value = '');
  el('ni_priority').value = 'MEDIUM';
  hide('ni_err');
  show('newModal');
}
const closeNewModal = () => hide('newModal');
async function submitNew() {
  const title = el('ni_title').value.trim();
  if (!title) { el('ni_err').textContent = 'Title is required!'; show('ni_err'); return; }
  hide('ni_err');
 const payload = {
    title,
    body:     el('ni_body').value.trim(),
    priority: el('ni_priority').value,
    assignee: el('ni_assignee').value.trim() || 'admin',
    labels:   el('ni_labels').value.split(',').map(s => s.trim()).filter(Boolean),
    status:   'open'
  };
 const fake = { ...payload, _id: 'local_' + Date.now(), number: ALL.length + 1, createdAt: new Date().toISOString(), author: 'admin' };
  try {
    const json  = await fetch(`${API}/issues`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }).then(r => r.json());
    const saved = json.issue || json.data || json || {};
    ALL.unshift({ ...fake, ...saved });
  } catch {
    ALL.unshift(fake);
  }
  closeNewModal();
  render();
}