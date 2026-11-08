# Nova Browser 0.1.0 — source preview

Nova is an original Electron + bundled Chromium browser shell targeting a native Apple Silicon build. It renders real websites; it is not a mock-up. **It is not yet a verified or security-audited daily-driver release.** This handoff contains source, an M1 build recipe and Linux/x86_64 test results. It does **not** contain a genuine macOS `.app` or `.dmg`.

## Current feature status

Implemented in source: secure browser UI/webview separation; URL/search navigation; normal and private windows; tabs, vertical tab layout, groups, workspaces and split view; bookmarks and local history; downloads with progress controls; simple reader; screenshot save path; AI/translation prompt workflow; encrypted password-vault operations; unpacked-extension manager using Electron's extension APIs; Ghostery ad/tracker filter engine; permissions/privacy settings; session restore and renderer/process recovery.

Verified in this Linux run: local Chromium navigation, Google, YouTube, Google account sign-in page, Instagram, Facebook and React; bookmark/history; tabs, split/vertical layout, workspace/group; local download; reader text extraction; private-window history isolation; sample MP4 playback; clean-restart session restore; forced main-process kill and restore; Electron unpacked-extension API load; Ghostery engine initialization. The precise report is `results/electron-smoke.json`.

Still unverified or intentionally limited: M1/ARM64 behavior and actual `.app`/`.dmg`; macOS Keychain; DRM, hardware video decode, audio output and PiP; AI/translation with a real provider; screenshot save dialog; extension folder-picker UI; real-site ad-filter enforcement; logged-in Gmail/social workflows; signing/notarization. These are **not** represented as passed. Electron supports only unpacked extensions and a subset of extension APIs here; Chrome Web Store/CRX compatibility is not provided.

## Requirements and run

Use **Node.js 22.12.0 or later** (the project declares `>=22.12.0`; Electron 45 is not supported by Node 20.20.2). With `nvm`:

```sh
nvm install 22.12.0
nvm use 22.12.0
npm ci
npm start
```

On a headless Linux development host with Electron's system libraries and Xvfb installed:

```sh
npm run lint:syntax
npm test
npm audit
env -u NODE_OPTIONS xvfb-run -a npx -y -p node@22.12.0 -c 'node scripts/electron-smoke.js'
```

The Playwright smoke suite visits external websites and needs network access. It uses a disposable profile and logs results to `results/electron-smoke.json`.

## Apple Silicon build

A genuine ARM64 app/DMG must be built on macOS. On an Apple Silicon Mac with Xcode Command Line Tools and Node >=22.12.0:

```sh
./scripts/build-mac-arm64.sh
```

This creates an electron-builder ARM64 DMG under `release/` if packaging succeeds. This project has not run that build in this Linux environment. The current macOS identity is ad-hoc (`-`); the artifact is **not Developer ID signed/notarized** and is not ready for broad distribution. See `docs/INSTALLATION.md` for verification/signing steps.

## Security and data

Remote sites are Chromium webview guests with Node integration disabled, context isolation, sandbox and web security enabled. The local UI has a restrictive CSP and narrow preload bridge; main-process IPC checks the trusted local main frame. OS-backed secret storage is required for API-key/password operations; if unavailable, secret saving is refused. Linux reported Electron `basic_text`, so no key was saved in the smoke tests. AI requests are user-triggered, block private-window use and target public HTTPS endpoints; page text is sent only on submission. The ad/tracker engine initialized, but filter enforcement was not independently verified. This project has not had an independent security review. Review `docs/SECURITY.md` before using it with sensitive accounts.

## Project documents

- `docs/TEST_REPORT.md` — actual checks and explicit `NOT RUN` items.
- `docs/KNOWN_ISSUES.md` — feature boundaries and remaining work.
- `docs/INSTALLATION.md` — exact Node and Apple Silicon build/verification steps.
- `docs/SECURITY.md`, `docs/ARCHITECTURE.md`, `docs/USER_MANUAL.md`.
- `docs/COMPARISON.md` — browser comparison and product research (not a claim that every compared feature is implemented).
- `docs/STATUS-AZ.md` — Azerbaijani handoff summary.
- `Source-Code.zip` — source/docs/tests archive; excludes installed dependencies.
