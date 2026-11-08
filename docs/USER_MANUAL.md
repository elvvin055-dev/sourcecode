# User manual — implemented source behavior

## Browse and tabs

- Enter a domain or search phrase in the address field. Host-like input is normalized to HTTPS; arbitrary scripts/file/custom schemes are not accepted from the address field.
- Back, forward, reload/stop, address field, new tab and bookmark actions are available in the toolbar. Common shortcuts: `⌘L`, `⌘T`, `⌘W`, `⌘D`, `⌘R`, `⌘⇧N`.
- Tabs can be opened, switched, pinned/grouped through tab context actions, and shown vertically from the Tools menu. Split view needs at least two tabs in the active workspace.
- Workspaces and tab groups are separate concepts; browser state is saved locally. Complex migration/restore behavior has not had broad testing.

## Bookmarks, history, downloads, reader

- Use the left rail for Bookmarks, History and Downloads. These lists are local to the normal profile. Bookmark the current page using the star or `⌘D`.
- Downloads use Electron's default Downloads folder; the panel shows progress and offers pause/resume/cancel controls. The Linux smoke test verified a local completed download, not all control states or macOS Finder behavior.
- Reader extracts visible page text into a simple panel. It is not a full article parser or typography mode.
- Tools → Capture visible page requests a PNG capture and opens a native save dialog. The dialog path is implemented but was not exercised in the headless automated test.

## Private browsing

- `⌘⇧N` creates a separate private BrowserWindow with a non-persistent Chromium partition. The application does not add private navigation to persistent history or session restore; passwords and AI requests are unavailable there.
- Existing bookmarks remain readable in a private window. Private downloads may still create a file in the OS Downloads folder. A forensic review of all caches/files after close has not been completed.

## Passwords, extensions, privacy

- Password entries are held in an encrypted local vault using Electron `safeStorage`, and reveal is restricted to the matching website origin. The implementation is not a reviewed autofill/passkey manager. If Electron reports an unprotected storage backend, save/reveal operations are refused.
- Extension management uses Electron's `session.extensions` API and a user-selected unpacked extension folder. Chrome Web Store, `.crx`, and full Chrome-extension API compatibility are not supported. Review the requested permissions and extension source before loading it.
- Privacy settings expose ad/tracker filter status, per-site protection, permission choices and site-data clearing. Filter startup was smoke-tested; effectiveness against a representative tracker corpus has not been established.

## AI and translation prompt

- The assistant accepts an OpenAI-compatible HTTPS chat-completions endpoint/model and an API key stored only if OS-protected storage is available. Requests are user-submitted. The active page's extracted text and title may be sent to the configured endpoint along with the prompt; inspect what you submit and the provider's terms.
- The Translate action pre-fills an Azerbaijani translation prompt in the AI panel; it is not a built-in offline translation engine. AI is disabled in private windows. No provider call was tested in this handoff.

## Appearance and support

System/dark/light appearance, website permission prompts, and Chromium DevTools are exposed in the UI. Browser distribution, updates, Keychain behavior, GPU/PiP and OS integration still need native macOS validation. See `docs/TEST_REPORT.md` and `docs/KNOWN_ISSUES.md` before relying on any untested feature.
