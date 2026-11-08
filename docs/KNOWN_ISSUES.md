# Known issues and remaining work

## Environment and release
- No macOS `.app` or `.dmg` was produced here. The authoring/test host was Linux x86_64; M1, Retina, native macOS, Rosetta-absent launch, Gatekeeper, signing and notarization are all **NOT RUN**.
- The app declares Node `>=22.12.0`; system Node 20.20.2 is too old for the bundled Electron version. Use Node 22.12.0 or newer and `npm ci`.
- This is an unsigned development build with no updater, signing identity, notarization or Chromium patch/update SLA.

## Browser services and security
- The Ghostery filter engine starts and is enabled in the smoke test, but request-level ad/tracker blocking has not been independently proved. Its Electron `webRequest` listeners must not be overwritten by later code.
- No Safe Browsing/phishing reputation, comprehensive anti-fingerprinting, HTTPS-First warning/fallback flow, secure DNS, site-isolation policy review or user-facing cookie controls.
- Password vault encryption uses `safeStorage`, but current implementation lacks audited autofill/passkeys and the macOS Keychain path is not tested. Linux basic-text backend refuses writes.
- Extension manager/API is for user-selected unpacked folders and an Electron API subset. API loading was smoke-tested with a fixture; folder-picker/enable/disable/remove UI was not. Chrome Web Store, CRX and arbitrary Chrome extension parity are unsupported.
- Private browsing uses isolated ephemeral session partitions; smoke tested history isolation, but a full forensic test of cache, permission state, download files, crash leftovers and OS data cleanup has not been done.

## Features requiring real-device or further testing
- M1 ARM64 build, GPU/hardware video decode, audio output, PiP, Retina scaling, memory/battery behavior, external displays, sleep/wake, macOS notifications and media/DRM are NOT RUN.
- AI/translation request, secret persistence on Keychain, screenshot native save dialog, and extension folder dialog are NOT RUN.
- Website checks cover landing/sign-in pages, not authenticated Gmail/social workflows, checkout, DRM video or long sessions. Network availability and anti-automation behavior can change results.
- Split view/workspaces/groups have functional UI logic and passed basic smoke interactions; complex tab moves, collisions, restore edge cases and accessibility remain untested.
- Download pause/resume/cancel logic is present, but the smoke verified only a completed local download, not every control/state or OS download behavior.
- Reader is a basic visible-text extraction panel, not a full typography/reader-mode engine. Translation opens an AI prompt, not an offline translation service.
- No audio loopback or native PiP test. A sample remote MP4 reached readyState 4 with no media error in Linux/Xvfb; this is not evidence of M1 hardware decoding.

## Product scope
No claim is made that Nova is ready for sensitive daily browsing. The next release gate is a reproducible Apple Silicon build plus a security review and expanded regression tests for media, filtering, extension permissions, downloads, private cleanup and macOS Keychain.
