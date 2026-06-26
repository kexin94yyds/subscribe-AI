# macOS Swift Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a double-clickable macOS `.app` that reuses MonoExpire's existing React/Appwrite sync code without requiring a browser or manually started dev server.

**Architecture:** Add a SwiftPM AppKit shell that starts a local-only static server on `localhost:41731`, serves the bundled Vite `dist/` directory, and displays it in `WKWebView`. Keep React and Appwrite sync unchanged.

**Tech Stack:** SwiftPM, AppKit, WebKit, Network.framework, React 19, Vite 6, Appwrite Web SDK 26.

## Global Constraints

- Keep the existing React business UI and Appwrite sync implementation.
- Use `http://localhost:41731/` for the Mac app web origin.
- Do not use `file://`, custom URL schemes, Electron, or Tauri.
- Package a local `.app`; notarization is out of scope.
- Follow TDD for testable Swift support code.

---

### Task 1: Static Server Support

**Files:**
- Create: `macos/Package.swift`
- Create: `macos/Sources/MonoExpireMacSupport/StaticFileServer.swift`
- Create: `macos/Tests/MonoExpireMacSupportTests/StaticFileServerTests.swift`

**Interfaces:**
- Produces: `StaticFileResponder(webRoot: URL)`
- Produces: `StaticFileResponder.response(forPath: String, method: String) -> HTTPResponse`
- Produces: `HTTPResponse(statusCode: Int, reasonPhrase: String, headers: [String: String], body: Data)`

- [ ] Write Swift tests that create a temporary web root containing `index.html` and `assets/app.js`.
- [ ] Verify `/assets/app.js` returns JavaScript MIME and file contents.
- [ ] Verify `/accounts/123` falls back to `index.html`.
- [ ] Verify `/../secret.txt` returns `403 Forbidden`.
- [ ] Run `swift test --package-path macos` and confirm the tests fail because the package does not exist yet.
- [ ] Add the SwiftPM package and minimal support implementation.
- [ ] Run `swift test --package-path macos` and confirm the tests pass.

### Task 2: AppKit WKWebView Shell

**Files:**
- Create: `macos/Sources/MonoExpireMac/main.swift`
- Modify: `macos/Sources/MonoExpireMacSupport/StaticFileServer.swift`

**Interfaces:**
- Consumes: `StaticFileServer(webRoot: URL, port: UInt16)`
- Produces: a foreground AppKit app named `MonoExpire` with one `WKWebView` window.

- [ ] Add `StaticFileServer` around `NWListener` that serves `StaticFileResponder` responses.
- [ ] Add AppKit entry point with `NSApplication`, `NSWindow`, and `WKWebView`.
- [ ] Resolve bundled web root from `Bundle.main.resourceURL/dist`.
- [ ] Show a visible error view if the server fails to start or `dist/index.html` is missing.
- [ ] Run `swift build --package-path macos`.

### Task 3: Build And Run Script

**Files:**
- Create: `script/build_and_run.sh`
- Create: `.codex/environments/environment.toml`
- Modify: `package.json`

**Interfaces:**
- Produces: `./script/build_and_run.sh [run|--verify|--logs|--telemetry|--debug]`
- Produces: `dist/MonoExpire.app`
- Produces npm script `mac:run`.

- [ ] Add `script/build_and_run.sh` that stops `MonoExpire`, runs `npm run build`, runs `swift build --package-path macos`, stages `dist/MonoExpire.app`, copies `dist` web assets into `Contents/Resources/dist`, writes `Info.plist`, and launches the bundle.
- [ ] Add `--verify` mode that launches the app, checks `pgrep -x MonoExpire`, and checks `curl -I http://localhost:41731/`.
- [ ] Add Codex Run action pointing at `./script/build_and_run.sh`.
- [ ] Add `mac:run` script to `package.json`.
- [ ] Run `./script/build_and_run.sh --verify`.

### Task 4: Regression Verification

**Files:**
- No source edits expected.

- [ ] Run `npm test -- components/SyncModal.test.tsx services/cloudSyncService.test.ts`.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm run build`.
- [ ] Run `swift test --package-path macos`.
- [ ] Run `./script/build_and_run.sh --verify`.
- [ ] Confirm `git status --short` only shows intended Mac app files and generated local artifacts are either ignored or intentionally tracked.

