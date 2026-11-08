# Security model and release checklist

Nova is an early development build, **not an independently audited secure browser**. Do not use it for high-risk accounts or confidential work until macOS validation and a security review are complete.

## Implemented controls

- Remote websites render in Chromium webview guests. Node integration is disabled; context isolation, sandbox and web security are enabled. Guest preload injection and arbitrary popup windows are disallowed.
- Browser chrome is loaded from local `index.html`, uses a restrictive CSP and a frozen, narrow `contextBridge` API. Main-process IPC requires the trusted local main frame; values are length/type sanitized before persistence.
- Navigation and external-window handling allow only `http:`/`https:` destinations; renderer-supplied schemes are not handed to the OS. Chromium's default TLS/certificate validation is not disabled.
- Permission requests default-deny; a limited set asks the user. Stored allow/deny decisions are origin- and permission-scoped.
- Normal profile state is stored under Electron user data. Private windows use separate non-persistent session partitions; private history/session/password/AI access is blocked. Private-window cookie/site-data clearing is scoped to that window's partition.
- Password vault and AI keys use Electron `safeStorage` encryption. Secret writes are refused if a protected backend is unavailable; reveal is origin-bound. The smoke host returned Linux `basic_text`, so password/key storage was not exercised there. macOS Keychain behavior remains unverified.
- AI requests require a saved key and explicit user submission, are disabled in private mode, require public HTTPS, reject common local/private address ranges, and disallow HTTP redirects. Page context is included only in that submitted request.
- Ghostery's Electron filter engine is wired to browser sessions. The smoke test verified initialization only; it did not prove a particular ad/tracker request is blocked. The fallback list is intentionally small if the package filter data fails.
- Renderer-process termination triggers a UI reload; a forced main-process kill followed by relaunch restored the saved tab in the Linux smoke run.

## Known security limitations

- This work has no independent threat-model review, penetration test, fuzzing, security SBOM, vulnerability disclosure process, auto-update channel or Electron/Chromium patch SLA. `npm audit` is a dependency advisory check, not a product security audit.
- Electron's `webRequest` API permits only one listener per event. The blocker uses it; any future feature registering competing listeners could disable or replace filtering. This interaction needs regression tests.
- DNS is checked before an AI fetch, but that is not a complete defense against DNS rebinding or every public-address edge case. Use only a trusted provider endpoint and do not send sensitive text unless you understand the provider's terms.
- Electron extensions are executable code. Only install unpacked extensions from a source you trust. Electron provides a subset of Chrome extension APIs; Chrome Web Store and arbitrary `.crx` installation are not supported.
- Password manager is a basic encrypted vault, not audited browser autofill/passkey infrastructure. Do not reuse a master secret or treat this feature as a replacement for a reviewed password manager.
- No Safe Browsing/phishing reputation service, anti-fingerprinting guarantee, HTTPS-First interstitial, certificate pinning, cookie-policy dashboard, or encrypted DNS is implemented.
- Ad/tracker blocking, private session cleanup, OS integration, GPU/media paths and macOS sandbox/signing behavior need further validation.

## Before any public release

1. Build on a supported Apple Silicon macOS host with a current supported Node/Electron combination; inspect Chromium/Electron security advisories and establish a patch SLA.
2. Audit every IPC handler and state mutation; fuzz URLs, frame-origin checks, private partitions, downloads and extension paths; commission independent security review.
3. Test permission prompts, session/data deletion, password/key migration, extension sandbox/permissions, filter enforcement, TLS errors and malicious site content.
4. Sign every app/helper with Developer ID, use appropriate hardened-runtime entitlements, notarize and staple the DMG, then verify Gatekeeper on a clean Mac/user account.
5. Add signed update metadata and rollback protections before promising ongoing security maintenance.
