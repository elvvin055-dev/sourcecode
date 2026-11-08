# Test report — 8 November 2026

## Environment

- Linux x86_64 sandbox, Node.js **22.12.0**, npm **10.8.2**, Electron **45.2.3**, Playwright **1.65.0**, Xvfb.
- The project declares Node `>=22.12.0`. The initially available Node 20.20.2 is too old for this Electron package; all final checks used Node 22.12.0 through `npx -y -p node@22.12.0 -c '...'`.
- This is not macOS/Apple Silicon. It has no Xcode, `hdiutil`, Apple Keychain, signing identity or notarization credentials.

## Final checks completed

- `npm ci` — PASS; 294 packages installed, 0 vulnerabilities reported during install.
- `npm run lint:syntax` — PASS; all source, test and script JavaScript syntax checks passed.
- `npm test` — PASS; 7/7 URL/search unit tests.
- `npm audit` — PASS; 0 known advisories reported for the committed dependency tree at test time. This is not a security audit.
- `env -u NODE_OPTIONS xvfb-run -a npx -y -p node@22.12.0 -c 'node scripts/electron-smoke.js'` — PASS overall, exit 0. Complete machine-readable output: `results/electron-smoke.json` (28 PASS, 8 explicitly marked NOT RUN, 0 FAIL).

## Electron / Chromium smoke results

**PASS:** app/UI/CSP startup; local real Chromium webview navigation; Ghostery engine initialization; password vault correctly refused to save a test credential on the unprotected Linux backend; bookmark create/list; history record/list; reader text extraction; tab create/switch; split view; vertical tabs; workspace create/switch; tab group create/assign; local download and manager entry; Google; YouTube landing/video page; Google account sign-in entry; Instagram; Facebook; React (HTTPS/JS-heavy site); private window creation/status; private navigation did not alter persistent history; sample MP4 reached `readyState=4` with no media error; session snapshot; clean-restart session restore; recovery after forced main-process `SIGKILL`; unpacked extension load through Electron's session extension API using a local fixture.

**Interpretation limits:** the Google Accounts page is only the signed-out sign-in entry, not an authenticated Gmail inbox. YouTube/social checks are landing/navigation checks, not login or media-service account checks. The sample MP4 proves software/browser media playback in this Linux/Xvfb run only, not audio output, DRM, GPU acceleration or M1 hardware decode. Ghostery initialization does not prove request-level blocking efficacy.

## NOT RUN / unsupported

- Apple Silicon M1/ARM64 `.app` and genuine `.dmg` creation; Rosetta absence; Retina/GPU/hardware video; audio output; macOS notifications; sleep/wake; Keychain; signing/notarization/Gatekeeper.
- Chrome Web Store or `.crx` installation is unsupported by this Electron implementation. The extension folder-picker UI was not automated; only programmatic unpacked extension API loading was tested.
- AI/translation provider call and protected key storage: Linux reported `basic_text`, and secret writes are refused. Native screenshot save dialog and OS Picture-in-Picture were not automated.
- Request-by-request tracker/ad-block enforcement; phishing/Safe Browsing; certificate/TLS edge cases; permission prompt flows; download pause/resume/cancel controls; private cache/download forensic cleanup; authenticated Gmail/social workflows; long-session and high-tab workload.

## Reproduction

```sh
# On Linux with Xvfb and Electron runtime libraries
npx -y -p node@22.12.0 -c 'npm ci && npm run lint:syntax && npm test && npm audit'
env -u NODE_OPTIONS xvfb-run -a npx -y -p node@22.12.0 -c 'node scripts/electron-smoke.js'
```

For release acceptance, build and test on a clean Apple Silicon Mac, verify all executable/helper architectures and signing, and repeat the browser/security/media scenarios listed in `docs/INSTALLATION.md` and `docs/SECURITY.md`.
