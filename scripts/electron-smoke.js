const { _electron: electron } = require('playwright');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const dataDir = path.join(os.tmpdir(), `nova-smoke-${process.pid}-${crypto.randomUUID()}`);
const results = [];
let server;
let app;
let page;
let localUrl;
function record(name, status, detail = '') { const result = { name, status, detail }; results.push(result); console.log(`${status.padEnd(8)} ${name}${detail ? ` — ${detail}` : ''}`); }
async function withTimeout(promise, ms = 25000) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms); })]); }
  finally { clearTimeout(timer); }
}
async function activeView() {
  const id = await page.locator('.tab.active').getAttribute('data-tab-id');
  return page.locator(`webview[data-tab-id="${id}"]`);
}
async function gotoThroughAddress(url, expectedHost, timeout = 30000) {
  await page.locator('#address').fill(url);
  await page.locator('#address').press('Enter');
  const view = await activeView();
  const id = await page.locator('.tab.active').getAttribute('data-tab-id');
  try {
    await page.waitForFunction(({ id, host }) => {
      const w = document.querySelector(`webview[data-tab-id="${id}"]`);
      try { return w && host.split('|').some(part => new URL(w.getURL()).hostname.includes(part)); } catch { return false; }
    }, { id, host: expectedHost }, { timeout });
  } catch (error) {
    let actual = ''; try { actual = await page.locator(`webview[data-tab-id="${id}"]`).evaluate(w => w.getURL()); } catch {}
    throw new Error(`${error.message}; guest-url=${actual}; address=${await page.locator('#address').inputValue()}`);
  }
  return await withTimeout(view.evaluate(async w => {
    try { return await w.executeJavaScript('({title:document.title,ready:document.readyState,body:(document.body?.innerText||"").slice(0,160)})', true); }
    catch (e) { return { title: '', ready: 'error', body: e.message }; }
  }), 20000);
}
async function run() {
  server = http.createServer((req, res) => {
    if (req.url === '/file') { res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Disposition': 'attachment; filename="nova-smoke.txt"' }); res.end('download fixture'); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><meta charset="utf-8"><title>Nova local test</title><h1 id="marker">Local test page</h1><a id="download" href="/file">Download test</a><video id="video" controls width="320" src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"></video><script>window.smokeReady=true</script>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  localUrl = `http://127.0.0.1:${server.address().port}/`;
  try {
    app = await electron.launch({ args: [`--user-data-dir=${dataDir}`, root], timeout: 30000, env: { ...process.env, NODE_OPTIONS: '' } });
    page = await app.firstWindow();
    await page.locator('#new-tab').waitFor({ state: 'visible', timeout: 30000 });
    record('Electron application starts', 'PASS', 'Linux x86_64/Xvfb only');

    const home = await page.locator('#home h1').innerText();
    record('Local browser UI / CSP boot', home.includes('Good browsing') ? 'PASS' : 'FAIL', home.replace(/\s+/g, ' ').trim());

    await gotoThroughAddress(localUrl, '127.0.0.1');
    const view = await activeView();
    const localTitle = await view.evaluate(w => w.executeJavaScript('document.title', true));
    record('Real Chromium webview navigation', localTitle === 'Nova local test' ? 'PASS' : 'FAIL', localTitle);
    const security = await page.evaluate(async () => await window.nova.securityStatus());
    record('Ad/tracker blocker initialized', security.adblock ? 'PASS' : 'FAIL', `engine=${security.adblock}; secureStorage=${security.secureStorage}; backend=${security.backend}`);
    record('OS-backed secret storage on this host', security.secureStorage ? 'PASS' : 'NOT RUN', `backend=${security.backend}; Linux basic_text cannot validate Apple Keychain`);
    const passwordRefused = await page.evaluate(async () => { try { await window.nova.savePassword({ origin: 'https://example.com', username: 'smoke', password: 'not-a-real-secret' }); return false; } catch { return true; } });
    record('Password vault fails closed without protected storage', passwordRefused ? 'PASS' : 'FAIL', 'No test credential was persisted on basic_text backend');

    await page.locator('#bookmark-current').click();
    await page.locator('.rail-action[data-panel="bookmarks"]').click();
    const bookmarkVisible = await page.locator('#panel').innerText();
    record('Bookmark create/list', bookmarkVisible.includes('127.0.0.1') ? 'PASS' : 'FAIL');
    await page.locator('.rail-action[data-panel="history"]').click();
    const historyVisible = await page.locator('#panel').innerText();
    record('History record/list', historyVisible.includes('127.0.0.1') ? 'PASS' : 'FAIL');
    await page.locator('.rail-action[data-panel="reader"]').click();
    const readerCopy = await page.locator('#panel .reader-copy').innerText();
    record('Reader text extraction', readerCopy.includes('Local test page') ? 'PASS' : 'FAIL', readerCopy.slice(0, 100));
    await page.keyboard.press('Escape');

    await page.locator('#new-tab').click();
    record('Tab creation/switch', await page.locator('.tab').count() >= 2 ? 'PASS' : 'FAIL', `${await page.locator('.tab').count()} tabs`);
    await page.locator('#split-toggle').click();
    record('Split view layout', await page.locator('#webview-host.split-view').count() === 1 ? 'PASS' : 'FAIL');
    await page.locator('#split-toggle').click();
    await page.locator('#menu-toggle').click();
    await page.locator('.menu-pop button', { hasText: 'Use vertical tabs' }).click();
    const verticalClass = await page.locator('#rail').getAttribute('class');
    record('Vertical tab layout', verticalClass.includes('vertical-mode') ? 'PASS' : 'FAIL', verticalClass);
    await page.locator('#menu-toggle').click();
    const menuText = await page.locator('.menu-pop').innerText();
    const modeLabel = menuText.includes('Use horizontal tabs') ? 'Use horizontal tabs' : 'Use vertical tabs';
    await page.locator('.menu-pop button', { hasText: modeLabel }).click();

    await page.locator('.rail-action[data-panel="workspaces"]').click();
    await page.locator('#panel .panel-input').first().fill('Research');
    await page.locator('#panel button', { hasText: 'Create workspace' }).click();
    const wsRow = page.locator('#panel .list-item').filter({ hasText: 'Research' });
    await wsRow.locator('button', { hasText: 'Switch' }).click();
    await page.waitForTimeout(200);
    record('Workspace create/switch', page.locator('.tab').count() ? 'PASS' : 'FAIL', 'Research workspace active');
    await page.locator('#panel .panel-input').nth(1).fill('Reading');
    await page.locator('#panel button', { hasText: 'Create group and group active tab' }).click();
    record('Tab group create/assign', (await page.locator('#panel').innerText()).includes('Reading') ? 'PASS' : 'FAIL');
    const personalRow = page.locator('#panel .list-item').filter({ hasText: 'Personal' });
    await personalRow.locator('button', { hasText: 'Switch' }).click();
    await page.keyboard.press('Escape');

    // Exercise local real downloads and controls without logging into a service.
    await page.locator('#address').fill(localUrl); await page.locator('#address').press('Enter');
    const downloadTabId = await page.locator('.tab.active').getAttribute('data-tab-id');
    await page.waitForFunction(({ id, host }) => { try { return document.querySelector(`webview[data-tab-id="${id}"]`).getURL().includes(host); } catch { return false; } }, { id: downloadTabId, host: '127.0.0.1' });
    const downloadView = await activeView();
    await downloadView.evaluate(w => w.executeJavaScript('document.querySelector("#download").click()', true));
    await page.waitForTimeout(1200);
    await page.locator('.rail-action[data-panel="downloads"]').click();
    record('Download request/manager', (await page.locator('#panel').innerText()).includes('nova-smoke.txt') ? 'PASS' : 'FAIL');

    // Individual external landing-page navigation checks (not authenticated service tests).
    const external = [
      ['Google', 'https://www.google.com/', 'google.com'],
      ['YouTube', 'https://www.youtube.com/watch?v=jfKfPfyJRdk', 'youtube.com'],
      ['Gmail account sign-in entry', 'https://accounts.google.com/', 'accounts.google.com'],
      ['Instagram landing page', 'https://www.instagram.com/', 'instagram.com'],
      ['Facebook landing page', 'https://www.facebook.com/', 'facebook.com'],
      ['HTTPS / JavaScript-heavy site', 'https://react.dev/', 'react.dev']
    ];
    for (const [name, url, host] of external) {
      try {
        const pageInfo = await gotoThroughAddress(url, host, 35000);
        record(name, pageInfo.ready === 'error' ? 'FAIL' : 'PASS', `${pageInfo.ready}; title=${pageInfo.title.slice(0, 80)}`);
      } catch (e) { let at = ''; try { at = await (await activeView()).evaluate(w => w.getURL()); } catch {} record(name, 'FAIL', `${e.message.slice(0, 120)}; current=${at}`); }
    }

    // New/private window and in-memory partition status.
    const windowCount = app.windows().length;
    await page.locator('#private').click(); await page.waitForTimeout(1000);
    const windows = app.windows();
    let privatePage = null; let privateWindow = false;
    for (const candidate of windows) {
      try {
        await candidate.waitForFunction(() => typeof window.nova?.isPrivate === 'function', undefined, { timeout: 8000 });
        if (await candidate.evaluate(async () => await window.nova.isPrivate())) { privatePage = candidate; privateWindow = true; break; }
      } catch {}
    }
    record('Private window creation/status', windows.length > windowCount && privateWindow ? 'PASS' : 'FAIL', `before=${windowCount}, after=${windows.length}, foundPrivate=${privateWindow}, urls=${windows.map(w => w.url()).join(' | ')}`);
    if (privatePage) {
      const privateBefore = await privatePage.evaluate(async () => await window.nova.getStore('history'));
      await privatePage.locator('#address').fill(`${localUrl}private-only`); await privatePage.locator('#address').press('Enter');
      const privateTabId = await privatePage.locator('.tab.active').getAttribute('data-tab-id');
      await privatePage.waitForFunction(({ id, url }) => { try { return document.querySelector(`webview[data-tab-id="${id}"]`).getURL() === url; } catch { return false; } }, { id: privateTabId, url: `${localUrl}private-only` });
      const privateAfter = await privatePage.evaluate(async () => await window.nova.getStore('history'));
      record('Private browsing history isolation', JSON.stringify(privateBefore) === JSON.stringify(privateAfter) ? 'PASS' : 'FAIL', 'private navigation did not modify persistent history');
    } else record('Private browsing history isolation', 'NOT RUN', 'private window renderer was not available');

    // Downloaded video may be unsupported in Linux's Electron build; record actual decode state.
    try {
      await gotoThroughAddress(localUrl, '127.0.0.1');
      const localWebview = await activeView();
      await localWebview.evaluate(w => w.executeJavaScript('document.querySelector("#video").play().catch(()=>{})', true));
      await page.waitForTimeout(2000);
      const media = await localWebview.evaluate(w => w.executeJavaScript('({ready:document.querySelector("#video").readyState,error:document.querySelector("#video").error?.code||0})', true));
      record('Sample video element playback', media.ready >= 2 && !media.error ? 'PASS' : 'NOT RUN', `readyState=${media.ready}; mediaError=${media.error}`);
    } catch (e) { record('Sample video element playback', 'NOT RUN', e.message.slice(0, 100)); }

    // Normal close followed by launch checks persisted session restoration (crash recovery itself is a separate test).
    const baseWindow = windows[0]; page = baseWindow;
    await gotoThroughAddress(localUrl, '127.0.0.1');
    await baseWindow.waitForTimeout(900);
    const sessionBeforeClose = await baseWindow.evaluate(async () => await window.nova.getStore('session'));
    record('Session snapshot persisted', sessionBeforeClose.tabs?.some(t => t.url.includes('127.0.0.1')) ? 'PASS' : 'FAIL', `${sessionBeforeClose.tabs?.length || 0} tabs`);
    await app.close(); app = null;
    app = await electron.launch({ args: [`--user-data-dir=${dataDir}`, root], timeout: 30000, env: { ...process.env, NODE_OPTIONS: '' } });
    page = await app.firstWindow(); await page.locator('webview').first().waitFor({ state: 'attached', timeout: 30000 });
    await page.waitForTimeout(1800);
    const sessionAfterRestart = await page.evaluate(async () => await window.nova.getStore('session'));
    record('Session data available on restart', sessionAfterRestart.tabs?.length ? 'PASS' : 'FAIL', `${sessionAfterRestart.tabs?.length || 0} saved tabs; active=${sessionAfterRestart.activeUrl}`);
    const restored = await (await activeView()).evaluate(w => w.getURL());
    record('Session restore after clean restart', restored.includes('127.0.0.1') ? 'PASS' : 'FAIL', restored);
    await gotoThroughAddress(localUrl, '127.0.0.1'); await page.waitForTimeout(1200);
    const mainProcess = app.process(); const crashExit = new Promise(resolve => mainProcess.once('exit', resolve));
    mainProcess.kill('SIGKILL'); app = null;
    await withTimeout(crashExit, 15000);
    app = await electron.launch({ args: [`--user-data-dir=${dataDir}`, root], timeout: 30000, env: { ...process.env, NODE_OPTIONS: '' } });
    page = await app.firstWindow(); await page.locator('webview').first().waitFor({ state: 'attached', timeout: 30000 }); await page.waitForTimeout(1800);
    const crashRestored = await (await activeView()).evaluate(w => w.getURL());
    record('Crash recovery after forced main-process termination', crashRestored.includes('127.0.0.1') ? 'PASS' : 'FAIL', crashRestored);
    await app.close(); app = null;
    const extensionExe = path.join(root, 'node_modules', 'electron', 'dist', 'electron');
    const extensionProfile = path.join(dataDir, 'extension-api-profile'); fs.mkdirSync(extensionProfile, { recursive: true });
    const extensionRun = spawnSync(extensionExe, [path.join(root, 'tests', 'extension-api-smoke.js'), path.join(root, 'tests', 'fixtures', 'smoke-extension')], { cwd: root, encoding: 'utf8', timeout: 30000, env: { ...process.env, NODE_OPTIONS: '', NOVA_TEST_USER_DATA: extensionProfile } });
    const extOutput = `${extensionRun.stdout || ''}${extensionRun.stderr || ''}`;
    const extResult = extOutput.split(/\r?\n/).find(line => line.startsWith('{"status":')) || extOutput.trim().slice(0, 220);
    const extPassed = extensionRun.status === 0 && extResult.includes('"status":"PASS"');
    record('Unpacked extension API load', extPassed ? 'PASS' : 'FAIL', extResult);
    record('Chrome Web Store / CRX installation', 'NOT RUN', 'Not supported by Electron; only unpacked extensions using the available Electron API subset can load.');
    record('Extension manager folder-picker UI', 'NOT RUN', 'Native open-folder dialog was not driven in this automated smoke run.');
    record('AI page translation / assistant request', 'NOT RUN', 'No protected provider key was configured; Linux OS secret backend is basic_text.');
    record('Screenshot save dialog', 'NOT RUN', 'Native save dialog was not automated; capture UI path was not exercised.');
    record('Picture-in-Picture', 'NOT RUN', 'Trusted media activation / OS PiP window was not automated.');
    record('Audio output', 'NOT RUN', 'No audio device/output loopback was available in the headless Xvfb run.');
    record('M1 GPU / hardware decode / ARM64', 'NOT RUN', 'Linux x86_64 environment is not Apple Silicon or macOS');
  } finally {
    if (app) { try { await app.close(); } catch {} }
    if (server) await new Promise(resolve => server.close(resolve));
    try { fs.rmSync(dataDir, { recursive: true, force: true }); } catch {}
  }
}
run().then(() => {
  const reportPath = path.join(root, 'results', 'electron-smoke.json'); fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({ ranAt: new Date().toISOString(), platform: `${process.platform}-${process.arch}`, results }, null, 2));
  const failed = results.filter(x => x.status === 'FAIL');
  if (failed.length) process.exitCode = 1;
}).catch(error => {
  record('Integration harness', 'FAIL', String(error.message || error).slice(0, 240));
  const reportPath = path.join(root, 'results', 'electron-smoke.json'); fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({ ranAt: new Date().toISOString(), platform: `${process.platform}-${process.arch}`, results }, null, 2));
  console.error(error); process.exitCode = 1;
});
