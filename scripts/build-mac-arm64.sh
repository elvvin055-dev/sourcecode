#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Error: a real macOS build host is required to create a genuine DMG." >&2
  exit 2
fi
ARCH="$(uname -m)"
if [[ "$ARCH" != "arm64" ]]; then
  echo "Error: use an Apple Silicon host for a native ARM64 release (found $ARCH)." >&2
  exit 2
fi
if ! command -v xcodebuild >/dev/null || ! command -v hdiutil >/dev/null; then
  echo "Error: install Xcode Command Line Tools first." >&2
  exit 2
fi
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 12)) { console.error(`Error: Node.js >=22.12.0 is required (found ${process.versions.node}).`); process.exit(2); }'
npm ci
npm test
npm run lint:syntax
npm run package:mac:arm64
echo "Build complete. Verify code signing, all nested architectures, notarization and Gatekeeper before distribution."
