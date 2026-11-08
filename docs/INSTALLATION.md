# Installation and Apple Silicon build guide

## Artifact status for this handoff

There is **no `Nova Browser.app` or `.dmg` in this delivery**. Work was performed on Linux x86_64, not macOS/Apple Silicon; no real DMG has been fabricated or claimed. Signing/notarization are also unavailable here. Use `scripts/build-mac-arm64.sh` on a real Apple Silicon Mac to build it.

## Run from source

Requires Node.js **22.12.0 or newer** and npm. Electron 45 does not support the initially available Node 20.20.2. On macOS/Linux with nvm:

```sh
nvm install 22.12.0
nvm use 22.12.0
node --version   # v22.12.0
npm ci
npm start
```

The first launch creates a Chromium profile in Electron's platform-specific user-data directory. This is a development build; treat it as untrusted for sensitive browsing until the release/security gates are complete.

## Build a native ARM64 DMG on an M1/M2/M3/M4 Mac

Install Xcode Command Line Tools, switch to Node >=22.12.0, then run:

```sh
./scripts/build-mac-arm64.sh
```

The script checks Darwin, `arm64`, `xcodebuild`, `hdiutil` and the Node version; runs `npm ci`, unit tests and syntax checks; then calls electron-builder's ARM64 DMG target. On success, inspect the output under `release/`. The script has **not** been run on macOS in this handoff.

Verify the app on the build host (adjust the exact path if electron-builder changes it):

```sh
file "release/mac-arm64/Nova Browser.app/Contents/MacOS/Nova Browser"
lipo -info "release/mac-arm64/Nova Browser.app/Contents/MacOS/Nova Browser"
codesign --verify --deep --strict --verbose=2 "release/mac-arm64/Nova Browser.app"
spctl --assess --type execute --verbose "release/mac-arm64/Nova Browser.app"
```

Inspect every Electron helper/framework/native library for `arm64`. Test on a clean Mac with Rosetta absent; confirm Activity Monitor reports Apple architecture. Exercise Retina/scale, GPU/video, audio, PiP, trackpad, notifications, external displays, sleep/wake, crash recovery, private storage and long-session behavior. Record the actual Mac model/macOS version and measurements.

## Signing / notarization

The current electron-builder configuration uses ad-hoc identity `-`, not Developer ID. It is **not notarized** and may trigger Gatekeeper warnings. For public distribution, configure a Developer ID Application identity, sign all nested Electron helpers with hardened runtime and appropriate entitlements, submit with Apple's `notarytool`, staple the ticket, and verify Gatekeeper on a clean machine. Do not distribute the current configuration as a production release.

## Test commands

```sh
npm run lint:syntax
npm test
npm audit
# Linux/Xvfb only; external website checks require network access
env -u NODE_OPTIONS xvfb-run -a npx -y -p node@22.12.0 -c 'node scripts/electron-smoke.js'
```

See `docs/TEST_REPORT.md` for passed checks and `NOT RUN` cases.

## Rebuild the source archive

From the repository root:

```sh
zip -r Source-Code.zip README.md package.json package-lock.json src docs scripts tests assets results -x '*/node_modules/*' '*/release/*'
```

The archive intentionally excludes `node_modules` and release binaries.
