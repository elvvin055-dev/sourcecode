const $ = (q, root = document) => root.querySelector(q);
const $$ = (q, root = document) => [...root.querySelectorAll(q)];
const state = { tabs: [], active: null, bookmarks: [], history: [], downloads: [], workspaces: [], groups: [], currentWorkspace: 'default', splitIds: null, verticalTabs: false, privateMode: false, panel: null, theme: 'dark', toastTimer: null, filterStatus: false, initialized: false };
const cleanUrl = (input) => window.NovaUrl.cleanUrl(input);
const safeHost = (url) => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return 'New tab'; } };
const displayTitle = (tab) => tab.title && tab.title !== 'New tab' ? tab.title : safeHost(tab.url);
function toast(message) {
  const el = $('#toast'); el.textContent = message; el.classList.remove('hidden');
  clearTimeout(state.toastTimer); state.toastTimer = setTimeout(() => el.classList.add('hidden'), 2600);
}
function currentTab() { return state.tabs.find(t => t.id === state.active); }
function saveSession() {
  if (state.privateMode || !state.initialized) return;
  const tabs = state.tabs.map(t => ({ url: t.url || '', title: t.title || '', pinned: t.pinned, groupId: t.groupId || '', workspaceId: t.workspaceId || 'default' }));
  window.nova.setStore('session', { tabs, workspaces: state.workspaces, activeWorkspace: state.currentWorkspace, activeUrl: currentTab()?.url || '' }).catch(() => {});
}
function saveStore(name, data) { if (!state.privateMode) window.nova.setStore(name, data).catch(() => toast(`Couldn't save ${name}.`)); }
function updateAddress() {
  const tab = currentTab();
  $('#address').value = tab?.url || '';
  $('#security-icon').textContent = tab?.url?.startsWith('https:') ? '◈' : tab?.url?.startsWith('http:') ? '!' : '◈';
}
function showHome(tab) {
  const split = state.splitIds && state.splitIds.length === 2;
  const host = $('#webview-host'); host.classList.toggle('split-view', !!split);
  let divider = $('#split-divider');
  if (split && !divider) { divider = el('div', 'split-divider'); divider.id = 'split-divider'; divider.setAttribute('aria-hidden', 'true'); host.append(divider); }
  if (!split && divider) divider.remove();
  for (const item of state.tabs) {
    if (item.webview.parentElement !== host) host.append(item.webview);
    const visible = split ? state.splitIds.includes(item.id) : item.id === tab?.id;
    item.webview.classList.toggle('hidden', !visible);
    item.webview.style.gridColumn = split ? (item.id === state.splitIds[0] ? '1' : item.id === state.splitIds[1] ? '3' : '') : '';
  }
  if (divider) { divider.style.gridColumn = split ? '2' : ''; divider.classList.toggle('hidden', !split); }
  const hasPage = split ? state.splitIds.some(id => !!state.tabs.find(t => t.id === id)?.url) : !!tab?.url;
  $('#home').classList.toggle('hidden', hasPage);
  host.classList.toggle('hidden', !tab?.webview && !split);
}
function renderTabs() {
  const bar = $('#tabbar'); bar.replaceChildren();
  const target = state.verticalTabs ? $('#vertical-tabs') : $('.tabbar-wrap');
  if (bar.parentElement !== target) {
    if (state.verticalTabs) target.append(bar); else target.insertBefore(bar, $('#add-tab'));
  }
  $('#rail').classList.toggle('vertical-mode', state.verticalTabs);
  $('.tabbar-wrap').classList.toggle('vertical-mode', state.verticalTabs);
  const visibleTabs = state.tabs.filter(t => (t.workspaceId || 'default') === state.currentWorkspace);
  const groupNames = new Map(state.groups.map(g => [g.id, g]));
  let lastGroup = null;
  visibleTabs.forEach(tab => {
    const group = groupNames.get(tab.groupId);
    if (group && group.id !== lastGroup) { const label = el('div', 'section-label', group.name); label.style.color = group.color || ''; bar.append(label); lastGroup = group.id; }
    const item = document.createElement('div'); item.className = `tab${tab.id === state.active ? ' active' : ''}`; item.dataset.tabId = tab.id; item.setAttribute('role', 'tab'); item.title = `${tab.pinned ? 'Pinned · ' : ''}${displayTitle(tab)}`;
    const icon = group ? el('span', 'group-dot') : el('span', 'tab-favicon', tab.loading ? '◌' : tab.pinned ? '•' : 'N');
    if (group) { icon.style.setProperty('--group-color', group.color || 'var(--accent)'); icon.title = group.name; }
    const title = el('span', 'tab-title', displayTitle(tab));
    const close = el('button', 'tab-close', '×'); close.title = 'Close tab';
    close.addEventListener('click', e => { e.stopPropagation(); closeTab(tab.id); });
    item.append(icon, title, close); item.addEventListener('click', () => activateTab(tab.id));
    item.addEventListener('contextmenu', e => { e.preventDefault(); showTabContext(tab, e.clientX, e.clientY); });
    bar.append(item);
  });
  $('#back').disabled = !currentTab()?.canGoBack; $('#forward').disabled = !currentTab()?.canGoForward;
  $('#split-toggle').textContent = state.splitIds ? '▣' : '◫';
  $('#split-toggle').title = state.splitIds ? 'Close split view' : 'Split view';
}
function newTab(url = '', settings = {}) {
  const id = crypto.randomUUID();
  const view = document.createElement('webview');
  view.className = 'browser-view'; view.dataset.tabId = id;
  view.setAttribute('partition', state.privateMode ? 'nova-private-window' : 'persist:nova-default');
  view.setAttribute('webpreferences', 'contextIsolation=yes,sandbox=yes,webSecurity=yes');
  view.setAttribute('allowpopups', 'false'); view.setAttribute('src', 'about:blank');
  const tab = { id, title: 'New tab', url: '', loading: false, canGoBack: false, canGoForward: false, pinned: !!settings.pinned, groupId: settings.groupId || '', workspaceId: settings.workspaceId || state.currentWorkspace, crashed: false, domReady: false, pendingUrl: url || '', webview: view };
  state.tabs.push(tab); $('#webview-host').append(view);
  view.addEventListener('dom-ready', () => {
    tab.domReady = true;
    if (tab.pendingUrl) { const pending = tab.pendingUrl; tab.pendingUrl = ''; navigate(pending, tab); }
  });
  view.addEventListener('did-start-loading', () => { tab.loading = true; tab.crashed = false; renderTabs(); });
  view.addEventListener('did-stop-loading', () => { tab.loading = false; try { tab.canGoBack = view.canGoBack(); tab.canGoForward = view.canGoForward(); } catch {} renderTabs(); });
  view.addEventListener('page-title-updated', e => {
    tab.title = e.title || safeHost(tab.url);
    const entry = state.history.find(x => x.url === tab.url); if (entry) { entry.title = tab.title; saveStore('history', state.history); }
    renderTabs(); saveSession();
  });
  view.addEventListener('did-navigate', e => handleNavigate(tab, e.url));
  view.addEventListener('did-navigate-in-page', e => handleNavigate(tab, e.url));
  view.addEventListener('new-window', e => { if (e.url) navigateNewWindow(e.url); });
  view.addEventListener('did-fail-load', e => {
    if (e.errorCode === -3 || e.validatedURL === 'about:blank') return;
    tab.loading = false; tab.failure = e.errorDescription || 'Navigation failed';
    if (tab.id === state.active) toast(`${tab.failure} — use Reload to retry.`);
    renderTabs();
  });
  view.addEventListener('render-process-gone', e => { tab.loading = false; tab.crashed = true; toast(`Tab crashed (${e.reason || 'renderer'}). Reload to recover.`); renderTabs(); });
  activateTab(id); if (url) navigate(url, tab); return tab;
}
function navigateNewWindow(url) { const t = newTab(); navigate(url, t); }
function activateTab(id) {
  const target = state.tabs.find(t => t.id === id); if (!target) return;
  if ((target.workspaceId || 'default') !== state.currentWorkspace) { state.currentWorkspace = target.workspaceId || 'default'; state.splitIds = null; }
  else if (state.splitIds && !state.splitIds.includes(id)) state.splitIds = null;
  state.active = id; const tab = currentTab(); showHome(tab); updateAddress(); renderTabs(); closePanel(); saveSession();
}
function closeTab(id) {
  const index = state.tabs.findIndex(t => t.id === id); if (index < 0) return;
  const [tab] = state.tabs.splice(index, 1); tab.webview.remove();
  if (state.splitIds?.includes(id)) state.splitIds = null;
  if (state.active === id) {
    const sameWorkspace = state.tabs.filter(t => (t.workspaceId || 'default') === state.currentWorkspace);
    const next = sameWorkspace[Math.min(index, sameWorkspace.length - 1)] || state.tabs[0];
    if (next) activateTab(next.id); else newTab();
  } else { showHome(currentTab()); renderTabs(); }
  saveSession();
}
function handleNavigate(tab, url) {
  if (!/^https?:\/\//i.test(url)) return;
  tab.url = url;
  try { tab.canGoBack = tab.webview.canGoBack(); tab.canGoForward = tab.webview.canGoForward(); } catch {}
  if (tab.id === state.active) { updateAddress(); showHome(tab); }
  if (!state.privateMode && /^https?:\/\//i.test(url)) {
    const entry = { url, title: tab.title || safeHost(url), visitedAt: Date.now() };
    state.history = [entry, ...state.history.filter(x => x.url !== url)].slice(0, 5000); saveStore('history', state.history);
  }
  renderTabs(); saveSession();
}
function navigate(input, tab = currentTab()) {
  if (!tab) tab = newTab();
  const url = cleanUrl(input);
  if (!url) { toast('Use a website address or a search query.'); return; }
  tab.url = url; tab.title = safeHost(url); tab.loading = true;
  $('#address').value = url; $('#suggestions').classList.add('hidden');
  showHome(tab); renderTabs();
  if (!tab.domReady) { tab.pendingUrl = url; saveSession(); return; }
  tab.webview.loadURL(url).catch(err => { tab.loading = false; toast(`Couldn't load page: ${String(err.message).slice(0, 100)}`); renderTabs(); });
}
function goAddress() { navigate($('#address').value); }
function closePanel() { $('#panel').classList.add('hidden'); $('#panel').replaceChildren(); state.panel = null; $$('.rail-action').forEach(x => x.classList.remove('selected')); }
function openPanel(name) {
  if (state.panel === name) { closePanel(); return; }
  state.panel = name; const panel = $('#panel'); panel.replaceChildren(); panel.classList.remove('hidden');
  $$('.rail-action[data-panel]').forEach(x => x.classList.toggle('selected', x.dataset.panel === name));
  const heading = document.createElement('div'); heading.className = 'panel-head';
  const h = document.createElement('h2'); h.textContent = ({ bookmarks: 'Bookmarks', history: 'History', downloads: 'Downloads', reader: 'Reader mode', assistant: 'AI assistant', passwords: 'Passwords', extensions: 'Extensions', workspaces: 'Workspaces & tab groups', privacy: 'Privacy & permissions' })[name] || name;
  const close = document.createElement('button'); close.className = 'panel-close'; close.textContent = '×'; close.onclick = closePanel; heading.append(h, close); panel.append(heading);
  if (name === 'bookmarks') renderBookmarks(panel);
  if (name === 'history') renderHistory(panel);
  if (name === 'downloads') renderDownloads(panel);
  if (name === 'reader') renderReader(panel);
  if (name === 'assistant') renderAssistant(panel);
  if (name === 'passwords') renderPasswords(panel);
  if (name === 'extensions') renderExtensions(panel);
  if (name === 'workspaces') renderWorkspaces(panel);
  if (name === 'privacy') renderPrivacy(panel);
}
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
function renderBookmarks(panel) {
  const search = el('input', 'panel-search'); search.placeholder = 'Find a bookmark…'; panel.append(search);
  const list = el('div', 'list'); panel.append(list);
  const draw = () => {
    list.replaceChildren(); const values = state.bookmarks.filter(b => `${b.title} ${b.url}`.toLowerCase().includes(search.value.toLowerCase()));
    if (!values.length) { list.append(el('div', 'empty', 'No bookmarks yet. Use ☆ on a page to save one.')); return; }
    values.forEach(b => { const row = el('div', 'list-item'); const main = el('div', 'list-main'); main.append(el('div', 'list-title', b.title), el('div', 'list-meta', b.url)); row.append(main); const remove = el('button', 'small-action', 'Remove'); remove.onclick = e => { e.stopPropagation(); state.bookmarks = state.bookmarks.filter(x => x.url !== b.url); saveStore('bookmarks', state.bookmarks); draw(); }; row.append(remove); row.onclick = () => navigate(b.url); list.append(row); });
  }; search.addEventListener('input', draw); draw();
}
function renderHistory(panel) {
  const search = el('input', 'panel-search'); search.placeholder = 'Search history…'; panel.append(search);
  const clear = el('button', 'small-action', 'Clear browsing history'); clear.style.margin = '11px 0'; clear.onclick = () => { state.history = []; saveStore('history', []); draw(); }; panel.append(clear);
  const list = el('div', 'list'); panel.append(list);
  const draw = () => { list.replaceChildren(); const values = state.history.filter(x => `${x.title} ${x.url}`.toLowerCase().includes(search.value.toLowerCase())); if (!values.length) list.append(el('div', 'empty', 'No saved history. Private sessions are never recorded.')); values.slice(0, 300).forEach(item => { const row = el('div', 'list-item'); const main = el('div', 'list-main'); main.append(el('div', 'list-title', item.title), el('div', 'list-meta', `${new Date(item.visitedAt).toLocaleString()} · ${item.url}`)); row.append(main); row.onclick = () => navigate(item.url); list.append(row); }); };
  search.addEventListener('input', draw); draw();
}
function renderDownloads(panel) {
  const note = el('p', 'panel-subtitle', 'Downloads are saved to your system Downloads folder. Completed files can be shown in Finder.'); panel.append(note);
  const list = el('div', 'list'); panel.append(list);
  if (!state.downloads.length) list.append(el('div', 'empty', 'Your downloads will appear here.'));
  state.downloads.forEach(d => {
    const row = el('div', 'list-item'); const main = el('div', 'list-main');
    const size = d.total ? `${(d.received / 1048576).toFixed(1)} / ${(d.total / 1048576).toFixed(1)} MB` : 'Receiving…';
    const speed = d.speed ? ` · ${(d.speed / 1024).toFixed(0)} KB/s` : '';
    main.append(el('div', 'list-title', d.filename), el('div', 'list-meta', `${d.state} · ${size}${speed}`)); row.append(main);
    if (d.state === 'progressing' || d.state === 'paused' || d.state === 'interrupted') { const action = el('button', 'small-action', d.state === 'progressing' ? 'Pause' : 'Resume'); action.onclick = async () => { const result = await window.nova.controlDownload(d.id, d.state === 'progressing' ? 'pause' : 'resume'); if (!result) toast('Download could not be controlled.'); }; row.append(action); }
    if (d.state === 'progressing' || d.state === 'interrupted') { const cancel = el('button', 'small-action', 'Cancel'); cancel.onclick = () => window.nova.controlDownload(d.id, 'cancel'); row.append(cancel); }
    if (d.path && d.state === 'completed') { const show = el('button', 'small-action', 'Finder'); show.onclick = () => window.nova.showInFinder(d.path); row.append(show); }
    list.append(row);
  });
}
async function renderReader(panel) {
  const tab = currentTab();
  const note = el('p', 'panel-subtitle', 'Extracts visible text from the current page for easier reading. This is a simple text view, not a full reader stylesheet.'); panel.append(note);
  if (!tab?.url || tab.url === 'about:blank') { panel.append(el('div', 'empty', 'Open a webpage first.')); return; }
  try {
    const data = await tab.webview.executeJavaScript(`({title:document.title,text:(document.querySelector('article')||document.querySelector('main')||document.body)?.innerText||''})`, true);
    if (state.panel !== 'reader') return;
    const text = String(data.text || '').slice(0, 15000).trim();
    panel.append(el('div', 'list-title', data.title || tab.title));
    const copy = el('button', 'small-action', 'Copy text'); copy.style.margin = '10px 0'; copy.onclick = async () => { try { await navigator.clipboard.writeText(text); toast('Text copied.'); } catch { toast('Clipboard access is unavailable.'); } }; panel.append(copy);
    const article = el('div', 'reader-copy', text || 'No readable page text found.'); panel.append(article);
  } catch { panel.append(el('div', 'empty', 'This page does not allow text extraction.')); }
}
function renderAssistant(panel) {
  const tab = currentTab();
  panel.append(el('p', 'panel-subtitle', 'AI is optional. When you submit, the page text shown below and your prompt are sent to your chosen HTTPS provider. Private mode disables AI.'));
  const provider = el('input', 'panel-input'); provider.value = localStorage.getItem('nova-ai-endpoint') || 'https://api.openai.com/v1/chat/completions'; provider.placeholder = 'OpenAI-compatible HTTPS endpoint'; provider.setAttribute('aria-label', 'AI provider endpoint'); panel.append(provider);
  const model = el('input', 'panel-input'); model.value = localStorage.getItem('nova-ai-model') || 'gpt-4o-mini'; model.placeholder = 'Provider model name'; model.style.marginTop = '8px'; panel.append(model);
  const key = el('input', 'panel-input'); key.type = 'password'; key.placeholder = 'Paste API key (stored using OS protected storage)'; key.style.marginTop = '8px'; panel.append(key);
  const keyRow = el('div'); keyRow.style.display = 'flex'; keyRow.style.gap = '8px'; keyRow.style.marginTop = '7px';
  const saveKey = el('button', 'small-action', 'Save API key'); saveKey.onclick = async () => { try { await window.nova.saveKey(key.value); key.value = ''; toast('API key encrypted and saved.'); } catch (e) { toast(e.message); } };
  const clearKey = el('button', 'small-action', 'Remove key'); clearKey.onclick = async () => { await window.nova.clearKey(); toast('Saved API key removed.'); };
  keyRow.append(saveKey, clearKey); panel.append(keyRow);
  const contextList = el('div', 'list'); contextList.style.margin = '10px 0';
  const contextTitle = el('div', 'section-label', 'Page context to include'); contextList.append(contextTitle);
  state.tabs.filter(t => t.url && t.url !== 'about:blank').forEach(t => { const row = el('label', 'toggle-row'); const input = document.createElement('input'); input.type = 'checkbox'; input.checked = t.id === tab?.id; input.dataset.tabId = t.id; row.append(input, document.createTextNode(` ${displayTitle(t)}`)); contextList.append(row); });
  panel.append(contextList);
  const consent = el('label', 'toggle-row'); const check = document.createElement('input'); check.type = 'checkbox'; check.checked = false; consent.append(check, document.createTextNode(' I consent to sending the selected page text and my prompt')); panel.append(consent);
  const prompt = el('textarea', 'panel-textarea'); prompt.placeholder = 'Ask a question, summarize, compare, translate…'; prompt.style.marginTop = '3px'; panel.append(prompt);
  const ask = el('button', 'primary-button', 'Ask about this page'); panel.append(ask);
  const answer = el('div', 'assistant-answer', ''); answer.classList.add('hidden'); panel.append(answer);
  ask.onclick = async () => {
    if (!check.checked) { toast('Confirm that you want to send page context.'); return; }
    if (!tab || !tab.url || tab.url === 'about:blank') { toast('Open a webpage first.'); return; }
    if (!prompt.value.trim()) { toast('Enter a question first.'); return; }
    const selectedIds = $$('input[data-tab-id]:checked', contextList).map(x => x.dataset.tabId);
    if (!selectedIds.length) { toast('Select at least one page for context.'); return; }
    ask.disabled = true; ask.textContent = 'Working…'; answer.classList.add('hidden');
    try {
      const pages = await Promise.all(state.tabs.filter(t => selectedIds.includes(t.id)).map(async t => {
        const page = await t.webview.executeJavaScript(`({title:document.title,text:(document.querySelector('article')||document.querySelector('main')||document.body)?.innerText||''})`, true);
        return `SOURCE TAB: ${t.title}\nURL: ${t.url}\n${String(page.text || '').slice(0, 10000)}`;
      }));
      localStorage.setItem('nova-ai-endpoint', provider.value.trim()); localStorage.setItem('nova-ai-model', model.value.trim());
      answer.textContent = await window.nova.askAI({ prompt: prompt.value, pageText: pages.join('\n\n---\n\n').slice(0, 24000), title: pages.length > 1 ? 'Selected browser tabs' : tab.title, endpoint: provider.value.trim(), model: model.value.trim() }); answer.classList.remove('hidden');
    } catch (e) { answer.textContent = e.message || 'AI request failed.'; answer.classList.remove('hidden'); }
    finally { ask.disabled = false; ask.textContent = 'Ask about this page'; }
  };
}
async function renderPasswords(panel) {
  const status = await window.nova.passwordStatus().catch(() => ({ available: false, backend: 'unknown' }));
  panel.append(el('p', 'panel-subtitle', status.available ? `Encrypted with OS storage (${status.backend}). Credentials are never autofilled without your click.` : 'Secure OS storage is unavailable in this environment. Password storage is disabled.'));
  if (!status.available || state.privateMode) { panel.append(el('div', 'empty', state.privateMode ? 'Password access is disabled in Private Browsing.' : 'Use macOS Keychain-backed secure storage on the target Mac.')); return; }
  const tab = currentTab(); let origin = ''; try { origin = new URL(tab?.url).origin; } catch {}
  const user = el('input', 'panel-input'); user.placeholder = 'Username'; panel.append(user);
  const pass = el('input', 'panel-input'); pass.type = 'password'; pass.placeholder = 'Password'; pass.style.marginTop = '7px'; panel.append(pass);
  const controls = el('div'); controls.style.display = 'flex'; controls.style.gap = '8px'; controls.style.marginTop = '8px';
  const generate = el('button', 'small-action', 'Generate strong password'); generate.onclick = async () => { pass.value = await window.nova.generatePassword(22); pass.type = 'text'; toast('Generated password — save it in a trusted manager.'); };
  const save = el('button', 'primary-button', 'Save for this site'); save.style.width = 'auto'; save.style.margin = '0';
  save.onclick = async () => { try { await window.nova.savePassword({ origin, username: user.value, password: pass.value, label: tab?.title || origin }); user.value = ''; pass.value = ''; toast('Credential saved securely.'); draw(); } catch (e) { toast(e.message); } };
  controls.append(generate, save); panel.append(controls);
  const search = el('input', 'panel-search'); search.placeholder = 'Search saved logins…'; search.style.margin = '14px 0 9px'; panel.append(search);
  const list = el('div', 'list'); panel.append(list);
  async function draw() {
    list.replaceChildren();
    try {
      const entries = await window.nova.listPasswords();
      const filtered = entries.filter(x => `${x.label} ${x.origin} ${x.username}`.toLowerCase().includes(search.value.toLowerCase()));
      if (!filtered.length) { list.append(el('div', 'empty', 'No saved credentials found.')); return; }
      for (const item of filtered) {
        const row = el('div', 'list-item'); const content = el('div', 'list-main'); content.append(el('div', 'list-title', item.label || item.origin), el('div', 'list-meta', `${item.username} · ${item.origin}`)); row.append(content);
        const fill = el('button', 'small-action', 'Fill'); fill.disabled = item.origin !== origin;
        fill.title = fill.disabled ? 'Credentials can only be filled on the exact saved origin.' : 'Fill fields on this page';
        fill.onclick = async e => { e.stopPropagation(); try { const secret = await window.nova.revealPassword(item.id, origin); const serialized = JSON.stringify({ username: secret.username, password: secret.password }).replace(/</g, '\\u003c'); const result = await tab.webview.executeJavaScript(`(()=>{const c=${serialized};const u=document.querySelector('input[autocomplete="username"],input[type="email"],input[name*="user" i]');const p=document.querySelector('input[autocomplete="current-password"],input[type="password"]');if(!u||!p)return false;for(const [e,v] of [[u,c.username],[p,c.password]]){const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(e,v);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}return true})()`, true); toast(result ? 'Login fields filled. Review before submitting.' : 'Could not find username/password fields.'); } catch (err) { toast(err.message); } };
        const remove = el('button', 'small-action', 'Delete'); remove.onclick = async e => { e.stopPropagation(); await window.nova.deletePassword(item.id); draw(); };
        row.append(fill, remove); list.append(row);
      }
    } catch (e) { list.append(el('div', 'empty', e.message)); }
  }
  search.oninput = draw; draw();
}
async function renderExtensions(panel) {
  panel.append(el('p', 'panel-subtitle', 'Installs unpacked extensions only. Electron implements a subset of Chrome extension APIs; Chrome Web Store and .crx installation are not supported. Only add code you trust.'));
  const install = el('button', 'primary-button', 'Install unpacked extension folder'); install.onclick = async () => { install.disabled = true; try { const result = await window.nova.installExtension(); if (!result.cancelled) toast(`Installed ${result.extension.name}`); draw(); } catch (e) { toast(e.message); } finally { install.disabled = false; } }; panel.append(install);
  const list = el('div', 'list'); list.style.marginTop = '12px'; panel.append(list);
  async function draw() {
    list.replaceChildren();
    const items = await window.nova.listExtensions().catch(() => []);
    if (!items.length) { list.append(el('div', 'empty', 'No extensions installed.')); return; }
    items.forEach(item => {
      const row = el('div', 'list-item'); const main = el('div', 'list-main'); main.append(el('div', 'list-title', `${item.name} ${item.version}`), el('div', 'list-meta', (item.permissions || []).join(', ') || 'No declared permissions')); row.append(main);
      const toggle = document.createElement('input'); toggle.type = 'checkbox'; toggle.checked = item.enabled; toggle.title = 'Enable extension'; toggle.onchange = async () => { try { await window.nova.setExtensionEnabled(item.id, toggle.checked); toast(toggle.checked ? 'Extension enabled.' : 'Extension disabled.'); } catch (e) { toggle.checked = !toggle.checked; toast(e.message); } };
      const remove = el('button', 'small-action', 'Remove'); remove.onclick = async () => { await window.nova.removeExtension(item.id); draw(); };
      row.append(toggle, remove); list.append(row);
    });
  }
  draw();
}
function renderWorkspaces(panel) {
  panel.append(el('p', 'panel-subtitle', 'Workspaces organize tabs locally. They share the same normal browsing cookies and profile; use Private Browsing for a separate temporary session.'));
  const name = el('input', 'panel-input'); name.placeholder = 'New workspace name'; panel.append(name);
  const add = el('button', 'primary-button', 'Create workspace'); panel.append(add);
  const workList = el('div', 'list'); workList.style.marginTop = '12px'; panel.append(workList);
  add.onclick = () => { const value = name.value.trim(); if (!value) return toast('Enter a workspace name.'); const ws = { id: crypto.randomUUID(), name: value.slice(0, 50), color: ['#97a7ff','#78cbb0','#f2b76d','#dc95c2'][state.workspaces.length % 4], createdAt: Date.now() }; state.workspaces.push(ws); saveStore('workspaces', state.workspaces); name.value = ''; draw(); };
  const groupTitle = el('div', 'section-label', 'Tab groups'); groupTitle.style.marginTop = '20px'; panel.append(groupTitle);
  const groupName = el('input', 'panel-input'); groupName.placeholder = 'Create a group for the current tab'; panel.append(groupName);
  const groupCreate = el('button', 'primary-button', 'Create group and group active tab'); panel.append(groupCreate);
  groupCreate.onclick = () => { const value = groupName.value.trim(); const tab = currentTab(); if (!value || !tab) return toast('Enter a group name and open a tab.'); const group = { id: crypto.randomUUID(), name: value.slice(0, 50), color: ['#97a7ff','#78cbb0','#f2b76d','#dc95c2'][state.groups.length % 4], collapsed: false }; state.groups.push(group); tab.groupId = group.id; groupName.value = ''; saveStore('groups', state.groups); renderTabs(); saveSession(); draw(); };
  const groupList = el('div', 'list'); groupList.style.marginTop = '8px'; panel.append(groupList);
  function draw() {
    workList.replaceChildren();
    state.workspaces.forEach(ws => { const row = el('div', 'list-item'); const label = el('div', 'list-main'); label.append(el('div', 'list-title', ws.name), el('div', 'list-meta', `${state.tabs.filter(t => t.workspaceId === ws.id).length} tabs`)); row.append(label); const switcher = el('button', 'small-action', state.currentWorkspace === ws.id ? 'Active' : 'Switch'); switcher.onclick = () => switchWorkspace(ws.id); row.append(switcher); if (ws.id !== 'default') { const del = el('button', 'small-action', 'Delete'); del.onclick = () => { state.tabs.filter(t => t.workspaceId === ws.id).forEach(t => t.workspaceId = 'default'); state.workspaces = state.workspaces.filter(x => x.id !== ws.id); if (state.currentWorkspace === ws.id) switchWorkspace('default'); saveStore('workspaces', state.workspaces); draw(); }; row.append(del); } workList.append(row); });
    if (!state.workspaces.some(x => x.id === state.currentWorkspace)) state.workspaces.unshift({ id: 'default', name: 'Personal', color: '#97a7ff', createdAt: Date.now() });
    groupList.replaceChildren();
    state.groups.forEach(group => { const row = el('div', 'list-item'); const label = el('div', 'list-main'); label.append(el('div', 'list-title', group.name), el('div', 'list-meta', `${state.tabs.filter(t => t.groupId === group.id).length} tabs`)); row.append(label); const assign = el('button', 'small-action', 'Group active tab'); assign.onclick = () => { const tab = currentTab(); if (tab) { tab.groupId = group.id; renderTabs(); saveSession(); draw(); } }; const remove = el('button', 'small-action', 'Remove group'); remove.onclick = () => { state.tabs.filter(t => t.groupId === group.id).forEach(t => t.groupId = ''); state.groups = state.groups.filter(g => g.id !== group.id); saveStore('groups', state.groups); saveSession(); renderTabs(); draw(); }; row.append(assign, remove); groupList.append(row); });
  }
  draw();
}
async function renderPrivacy(panel) {
  const tab = currentTab(); let host = ''; try { host = new URL(tab?.url).hostname.replace(/^www\./, ''); } catch {}
  const current = el('div', 'list-item'); const info = el('div', 'list-main'); info.append(el('div', 'list-title', host || 'No website active'), el('div', 'list-meta', state.filterStatus ? 'Ghostery ad and tracker lists active' : 'Filter list loading or fallback mode')); current.append(info); panel.append(current);
  if (host && !state.privateMode) {
    const toggle = el('label', 'toggle-row'); const check = document.createElement('input'); check.type = 'checkbox'; const status = await window.nova.protectionStatus(host).catch(() => ({ disabled: false })); check.checked = status.disabled;
    toggle.append(check, document.createTextNode(' Disable ad/tracker filtering for this site')); check.onchange = async () => { try { await window.nova.setSiteProtection(host, check.checked); toast(check.checked ? 'Protection paused for this site.' : 'Protection restored.'); } catch (e) { toast(e.message); } }; panel.append(toggle);
  }
  const clearData = el('button', 'primary-button', 'Clear cookies, cache, and browsing history'); clearData.style.marginTop = '14px'; clearData.onclick = async () => { try { await window.nova.clearSiteData(); state.history = []; saveStore('history', []); toast('Site data and history cleared.'); } catch (e) { toast(e.message); } }; panel.append(clearData);
  const title = el('div', 'section-label', 'Saved site permissions'); title.style.marginTop = '18px'; panel.append(title);
  const clear = el('button', 'small-action', 'Clear saved permissions'); clear.onclick = async () => { await window.nova.clearPermissions(); toast('Saved site permissions cleared.'); renderPrivacy(panel); }; panel.append(clear);
  const list = el('div', 'list'); list.style.marginTop = '8px'; panel.append(list);
  const rows = await window.nova.getPermissions().catch(() => []);
  if (!rows.length) list.append(el('div', 'empty', 'No remembered allow/block decisions. Sites ask before using supported permissions.'));
  rows.forEach(item => { const row = el('div', 'list-item'); const main = el('div', 'list-main'); main.append(el('div', 'list-title', item.origin), el('div', 'list-meta', `${item.permission}: ${item.decision}`)); row.append(main); list.append(row); });
}
function toggleBookmark() {
  const tab = currentTab(); if (!tab?.url || !/^https?:/.test(tab.url)) { toast('Open a website before bookmarking.'); return; }
  const index = state.bookmarks.findIndex(b => b.url === tab.url);
  if (index >= 0) { state.bookmarks.splice(index, 1); toast('Bookmark removed.'); }
  else { state.bookmarks.unshift({ title: tab.title || safeHost(tab.url), url: tab.url, createdAt: Date.now() }); toast('Bookmark saved.'); }
  saveStore('bookmarks', state.bookmarks); $('#bookmark-current').textContent = state.bookmarks.some(b => b.url === tab.url) ? '★' : '☆';
}
function showSuggestions() {
  const input = $('#address').value.trim().toLowerCase(), box = $('#suggestions'); box.replaceChildren();
  if (!input) { box.classList.add('hidden'); return; }
  const options = [...state.bookmarks, ...state.history].filter(x => `${x.title} ${x.url}`.toLowerCase().includes(input)).slice(0, 7);
  if (!options.length) { box.classList.add('hidden'); return; }
  options.forEach(item => { const row = el('div', 'suggestion'); row.append(el('span', '', '⌕'), el('span', '', `${item.title} — ${item.url}`)); row.onclick = () => navigate(item.url); box.append(row); }); box.classList.remove('hidden');
}
function applyTheme(theme) {
  state.theme = theme; const resolved = theme === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : theme;
  document.documentElement.dataset.theme = resolved; localStorage.setItem('nova-theme', theme);
}
matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => { if (state.theme === 'system') applyTheme('system'); });
function togglePageDevTools() {
  const view = currentTab()?.webview;
  if (!view) return toast('Open a webpage first.');
  if (view.isDevToolsOpened()) view.closeDevTools(); else view.openDevTools();
}
function toggleVerticalTabs() { state.verticalTabs = !state.verticalTabs; localStorage.setItem('nova-vertical-tabs', state.verticalTabs ? '1' : '0'); renderTabs(); saveSession(); }
function toggleSplitView() {
  if (state.splitIds) { state.splitIds = null; showHome(currentTab()); renderTabs(); return; }
  const candidates = state.tabs.filter(t => t.workspaceId === state.currentWorkspace);
  const left = currentTab() || candidates[0];
  let right = candidates.find(t => t.id !== left?.id);
  if (!right) right = newTab();
  state.splitIds = [left.id, right.id]; state.active = left.id; showHome(left); renderTabs(); saveSession();
}
function switchWorkspace(id) {
  if (!state.workspaces.some(w => w.id === id) && id !== 'default') return;
  const reopenManager = state.panel === 'workspaces';
  state.currentWorkspace = id; state.splitIds = null;
  const tab = state.tabs.find(t => (t.workspaceId || 'default') === id);
  if (tab) state.active = tab.id; else newTab();
  showHome(currentTab()); updateAddress(); renderTabs(); saveSession();
  if (reopenManager) { state.panel = null; openPanel('workspaces'); }
}
async function doPictureInPicture() {
  const tab = currentTab(); if (!tab?.url) return toast('Open a page with video first.');
  try {
    const ok = await tab.webview.executeJavaScript(`(async()=>{const vs=[...document.querySelectorAll('video')];const v=vs.find(x=>!x.paused&&!x.ended)||vs.find(x=>x.readyState>=2);if(!v)return false;if(document.pictureInPictureElement){await document.exitPictureInPicture();return true;}await v.requestPictureInPicture();return true})()`, true);
    if (!ok) toast('No playable video was found.');
  } catch (e) { toast(`Picture in Picture unavailable: ${e.message}`); }
}
function translatePage() { openPanel('assistant'); setTimeout(() => { const box = $('.panel-textarea'); if (box) { box.value = 'Translate the visible page into Azerbaijani. Preserve names and technical terms.'; box.focus(); } }, 0); }
function captureVisiblePage() {
  const tab = currentTab(); if (!tab?.url) return toast('Open a page first.');
  tab.webview.capturePage().then(image => window.nova.saveCapture('Nova-visible-page.png', image.toDataURL())).catch(e => toast(e.message));
}
function showTabContext(tab, x, y) {
  $('.menu-pop')?.remove(); const menu = el('div', 'menu-pop'); menu.style.left = `${Math.max(8, x)}px`; menu.style.top = `${Math.max(8, y)}px`; menu.style.right = 'auto'; document.body.append(menu);
  const add = (label, action) => { const b = el('button', '', label); b.onclick = () => { menu.remove(); action(); }; menu.append(b); };
  add(tab.pinned ? 'Unpin tab' : 'Pin tab', () => { tab.pinned = !tab.pinned; renderTabs(); saveSession(); });
  add('Duplicate tab', () => newTab(tab.url));
  add('Create group from this tab…', () => { const name = window.prompt('Tab group name'); if (!name?.trim()) return; const group = { id: crypto.randomUUID(), name: name.trim().slice(0, 50), color: ['#97a7ff','#78cbb0','#f2b76d','#dc95c2'][state.groups.length % 4] }; state.groups.push(group); tab.groupId = group.id; saveStore('groups', state.groups); saveSession(); renderTabs(); });
  state.workspaces.forEach(ws => add(`Move to ${ws.name}`, () => { tab.workspaceId = ws.id; if (state.active === tab.id && ws.id !== state.currentWorkspace) switchWorkspace(state.currentWorkspace); renderTabs(); saveSession(); }));
  add('Close tab', () => closeTab(tab.id));
  document.addEventListener('click', function dismiss(e) { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', dismiss); } }, { once: true });
}
function addMenu() {
  $('.menu-pop')?.remove(); const menu = el('div', 'menu-pop');
  const actions = [
    ['New tab', () => newTab()], ['New private window', () => window.nova.openPrivateWindow()],
    [state.verticalTabs ? 'Use horizontal tabs' : 'Use vertical tabs', toggleVerticalTabs], ['Split view', toggleSplitView],
    ['Capture visible page', captureVisiblePage], ['Reader mode', () => openPanel('reader')], ['Translate page with AI', translatePage], ['Picture in Picture', doPictureInPicture],
    ['Workspaces and tab groups', () => openPanel('workspaces')], ['Passwords', () => openPanel('passwords')], ['Extensions', () => openPanel('extensions')], ['Privacy and permissions', () => openPanel('privacy')],
    ['Clear browsing history', () => { state.history = []; saveStore('history', []); toast('History cleared.'); }],
    ['Theme: system / dark / light', () => applyTheme(state.theme === 'dark' ? 'light' : state.theme === 'light' ? 'system' : 'dark')]
  ];
  actions.forEach(([label, fn]) => { const b = el('button', '', label); b.onclick = () => { menu.remove(); fn(); }; menu.append(b); }); $('.toolbar').append(menu);
}

$('#back').onclick = () => { const t = currentTab(); if (t?.webview.canGoBack()) t.webview.goBack(); };
$('#forward').onclick = () => { const t = currentTab(); if (t?.webview.canGoForward()) t.webview.goForward(); };
$('#reload').onclick = () => { const t = currentTab(); if (t?.loading) t.webview.stop(); else t?.webview.reload(); };
$('#go').onclick = goAddress; $('#address').addEventListener('keydown', e => { if (e.key === 'Enter') goAddress(); if (e.key === 'Escape') $('#suggestions').classList.add('hidden'); });
$('#address').addEventListener('input', showSuggestions); $('#address').addEventListener('focus', showSuggestions);
$('#new-tab').onclick = $('#add-tab').onclick = () => newTab(); $('#bookmark-current').onclick = toggleBookmark;
$('#private').onclick = () => window.nova.openPrivateWindow(); $('#theme-toggle').onclick = () => applyTheme(state.theme === 'dark' ? 'light' : state.theme === 'light' ? 'system' : 'dark'); $('#menu-toggle').onclick = addMenu;
$('#split-toggle').onclick = toggleSplitView; $('#pip-toggle').onclick = doPictureInPicture; $('#translate-toggle').onclick = translatePage;
$$('.rail-action[data-panel]').forEach(b => b.addEventListener('click', () => openPanel(b.dataset.panel)));
$('#quick-links').addEventListener('click', e => { const url = e.target.dataset.url; if (url) navigate(url); });
document.addEventListener('click', e => { if (!e.target.closest('.address-wrap')) $('#suggestions').classList.add('hidden'); if (!e.target.closest('.menu-pop') && !e.target.closest('#menu-toggle')) $('.menu-pop')?.remove(); });
document.addEventListener('keydown', e => {
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'l') { e.preventDefault(); $('#address').focus(); $('#address').select(); }
  if (mod && e.key.toLowerCase() === 't') { e.preventDefault(); newTab(); }
  if (mod && e.key.toLowerCase() === 'w') { e.preventDefault(); if (currentTab()) closeTab(state.active); }
  if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); toggleBookmark(); }
  if (mod && e.key.toLowerCase() === 'r') { e.preventDefault(); $('#reload').click(); }
  if (mod && e.altKey && e.key.toLowerCase() === 'i') { e.preventDefault(); togglePageDevTools(); }
  if (mod && e.shiftKey && e.key.toLowerCase() === 'n') { e.preventDefault(); window.nova.openPrivateWindow(); }
  if (e.key === 'Escape') { closePanel(); $('.menu-pop')?.remove(); }
});
window.nova.on('browser:open-url', url => navigateNewWindow(url));
window.nova.on('browser:new-tab', () => newTab());
window.nova.on('browser:close-tab', () => { if (currentTab()) closeTab(state.active); });
window.nova.on('browser:reload', () => $('#reload').click());
window.nova.on('browser:toggle-devtools', togglePageDevTools);
window.nova.on('download:update', item => { const i = state.downloads.findIndex(x => x.id === item.id); if (i >= 0) state.downloads[i] = item; else state.downloads.unshift(item); if (state.panel === 'downloads') { state.panel = null; openPanel('downloads'); } });
(async function init() {
  state.privateMode = await window.nova.isPrivate();
  if (state.privateMode) { $('#privacy-status').textContent = 'Private window'; $('#private').classList.add('selected'); }
  const names = ['bookmarks','history','downloads','session','workspaces','groups'];
  const values = await Promise.all(names.map(name => window.nova.getStore(name).catch(() => name === 'session' ? { tabs: [] } : [])));
  const [bookmarks, history, downloads, sessionData, workspaces, groups] = values;
  state.bookmarks = bookmarks || []; state.history = state.privateMode ? [] : (history || []); state.downloads = state.privateMode ? [] : (downloads || []);
  state.workspaces = state.privateMode ? [{ id: 'default', name: 'Private', color: '#97a7ff' }] : (workspaces?.length ? workspaces : sessionData?.workspaces?.length ? sessionData.workspaces : [{ id: 'default', name: 'Personal', color: '#97a7ff' }]);
  if (!state.workspaces.some(x => x.id === 'default')) state.workspaces.unshift({ id: 'default', name: 'Personal', color: '#97a7ff' });
  state.groups = state.privateMode ? [] : (groups || []);
  state.currentWorkspace = state.privateMode ? 'default' : (state.workspaces.some(x => x.id === sessionData?.activeWorkspace) ? sessionData.activeWorkspace : 'default');
  const savedTheme = localStorage.getItem('nova-theme') || 'dark'; applyTheme(savedTheme);
  state.verticalTabs = localStorage.getItem('nova-vertical-tabs') === '1';
  const status = await window.nova.securityStatus().catch(() => ({})); state.filterStatus = !!status.adblock;
  const restored = state.privateMode ? [] : (sessionData?.tabs || []).filter(t => cleanUrl(t.url) && t.url !== 'about:blank').slice(0, 50);
  if (restored.length) {
    restored.forEach(t => newTab(t.url, { workspaceId: t.workspaceId || 'default', groupId: t.groupId, pinned: t.pinned }));
    const active = state.tabs.find(t => t.url === sessionData.activeUrl && t.workspaceId === state.currentWorkspace) || state.tabs.find(t => t.workspaceId === state.currentWorkspace) || state.tabs[0];
    if (active) { state.currentWorkspace = active.workspaceId; state.splitIds = null; activateTab(active.id); }
  } else newTab();
  state.initialized = true; saveSession();
})();
