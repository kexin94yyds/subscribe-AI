# macOS Swift Shell Design

## Goal

Build a real macOS `.app` for MonoExpire without rewriting the existing React business UI. The Mac app must launch by double-clicking, serve the bundled web build itself, and keep Appwrite Email OTP sync working through a `localhost` origin.

## Chosen Approach

Use a SwiftPM macOS executable that stages into a normal app bundle. The executable uses AppKit to create a foreground `NSWindow`, embeds a `WKWebView`, starts a local-only HTTP static server on `localhost:41731`, and loads the bundled Vite `dist/` assets from that URL.

This keeps the proven React, local storage, Appwrite Email OTP, and sync merge logic unchanged. It also avoids Appwrite CORS failures that would happen with `file://`, `app://`, `tauri://`, or `127.0.0.1` origins.

## Non-Goals

- Do not rewrite MonoExpire screens in SwiftUI.
- Do not add Electron or Tauri dependencies.
- Do not require the user to start `npm run dev` before launching the Mac app.
- Do not solve notarized distribution in this step; local build/run validation is enough.

## Components

- `macos/Package.swift`: SwiftPM package for the macOS app shell.
- `macos/Sources/MonoExpireMac`: AppKit entry point, window, and `WKWebView` loading.
- `macos/Sources/MonoExpireMacSupport`: static file server support code with testable path resolution and response generation.
- `macos/Tests/MonoExpireMacSupportTests`: Swift tests for SPA fallback, MIME selection, and path traversal protection.
- `script/build_and_run.sh`: single project-local entrypoint to build web assets, build Swift, stage `release/mac/MonoExpire.app`, and launch or verify it.
- `.codex/environments/environment.toml`: Codex app Run action pointing at `./script/build_and_run.sh`.

## Data And Sync

The Mac app loads `http://localhost:41731/`, so browser storage and Appwrite sessions are scoped to that stable origin. The user logs in once with Email OTP inside the Mac app and then uses the same cloud sync flow as web and iOS.

Because the Mac app uses port `41731`, it has a separate local storage origin from the development web app at `localhost:5173`. Initial Mac app data should be pulled from cloud sync after login.

## Error Handling

- If port `41731` is already in use, the app shows a clear startup error instead of silently loading the wrong origin.
- Static server requests are constrained to the bundled `dist` directory.
- Unknown SPA routes fall back to `index.html`.
- Missing required web assets produce a visible error page.

## Verification

- `swift test --package-path macos`
- `npm test -- components/SyncModal.test.tsx services/cloudSyncService.test.ts`
- `npx tsc --noEmit`
- `npm run build`
- `./script/build_and_run.sh --verify`
- `curl -I http://localhost:41731/` while the app is running
