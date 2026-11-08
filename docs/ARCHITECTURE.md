# Architecture and engineering decisions

## Runtime boundaries

- Electron main process owns BrowserWindows, webview policy, sessions, permission prompts, downloads, local JSON stores, encrypted vault/key files, extension loading, AI requests and native dialogs.
- Browser chrome is a local `index.html` renderer. It never loads remote pages into the privileged top-level window. Remote sites live in Chromium `<webview>` guests with `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true` and `webSecurity: true`.
- `preload.js` exposes a frozen, purpose-built `window.nova` API. `main.js` verifies that IPC senders are trusted local main frames and sanitizes stored data.
- Normal browser content uses `persist:nova-default`. Each private window gets a separate non-persistent session partition. Private visits do not persist history or sessions; password writes/reveals and AI requests are blocked.

## Application state and recovery

Bookmarks, history, session snapshots, workspaces/groups, permissions, download metadata, extension metadata and site rules are JSON in the Electron user-data folder. Password and AI-key material is encrypted with `safeStorage`, written with restrictive file permissions, and secret writes fail closed if the platform backend is unavailable. The Linux smoke host reported `basic_text`; Mac Keychain has not been validated.

The renderer saves normal tab URLs/metadata and the main renderer-gone hook reloads a crashed UI. A forced Linux main-process kill followed by a new launch restored the active URL in smoke testing. This is basic session recovery, not a crash-reporting, atomic database or full history reconstruction system.

## Network and site protection

- URL helpers accept only web URLs/search input; local browser UI has a restrictive CSP.
- Permission requests default-deny; supported asks are user-prompted and stored by origin/permission.
- Ghostery's Electron blocker attaches to browser sessions. The smoke test verifies initialization only; request-level blocking has not been independently measured. Electron provides one webRequest listener per event, so future listeners may conflict.
- No Safe Browsing/phishing service, comprehensive anti-fingerprinting, HTTPS-First UX or certificate exceptions are included.
- AI endpoints require HTTPS, are checked against common local/private address classes and reject redirects. DNS rebinding is not fully prevented.

## Extensions and capabilities

The extension manager uses Electron's `session.extensions` API for user-selected unpacked extension folders. Chrome Web Store/CRX installation and full Chrome WebExtension compatibility are explicitly outside scope. Extension permission review/UI and manager folder-dialog automation remain incomplete.

## M1/macOS strategy

electron-builder is configured for `arm64` DMG output. `scripts/build-mac-arm64.sh` requires a real Apple Silicon macOS host and Node >=22.12.0; it is an unexecuted build recipe, not proof of a produced artifact. No M1-only GPU flags or Rosetta runtime are bundled. Hardware decode, Retina, Keychain, native notifications, code signing, notarization and Gatekeeper require real Mac verification.
