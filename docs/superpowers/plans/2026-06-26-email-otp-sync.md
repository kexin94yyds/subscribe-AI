# Email OTP Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Appwrite Email OTP login so MonoExpire sync works on desktop web and iOS Capacitor without mobile deep-link callbacks.

**Architecture:** Keep cloud sync in `services/cloudSyncService.ts`, keep UI state in `App.tsx`, and keep form controls in `components/SyncModal.tsx`. Magic URL remains as a compatibility path; Email OTP becomes the main modal login path.

**Tech Stack:** React 19, TypeScript, Vite, Appwrite Web SDK 26, Capacitor iOS 7.

## Global Constraints

- Do not remove Magic URL compatibility.
- Do not require mobile email links to jump back into the app.
- Preserve existing local data merge behavior.
- Avoid broad UI redesign; only adjust sync modal login controls.

---

### Task 1: Service-Level OTP API

**Files:**
- Modify: `services/cloudSyncService.ts`

**Interfaces:**
- Produces: `sendCloudEmailOtp(email: string): Promise<{ userId: string }>`
- Produces: `verifyCloudEmailOtp(userId: string, otp: string): Promise<CloudSession>`

- [ ] Add `sendCloudEmailOtp` using `account.createEmailToken({ userId: ID.unique(), email })`.
- [ ] Add `verifyCloudEmailOtp` using `account.createSession({ userId, secret: otp })`, then `account.get()`.
- [ ] Keep existing `signInToCloud` Magic URL helper for compatibility.
- [ ] Run `npx tsc --noEmit`.

### Task 2: Sync Modal OTP UI

**Files:**
- Modify: `components/SyncModal.tsx`

**Interfaces:**
- Consumes: `onSendOtp(email: string): Promise<void>`
- Consumes: `onVerifyOtp(otp: string): Promise<void>`
- Consumes: `pendingOtpEmail?: string`

- [ ] Replace the signed-out one-button Magic URL form with an email field, a send-code button, an OTP field shown after send, and a verify button.
- [ ] Keep disabled/loading states tied to `status === 'syncing'` and local submit state.
- [ ] Use compact labels: `发送验证码`, `验证码`, `登录并同步`.
- [ ] Run `npx tsc --noEmit`.

### Task 3: App Coordination

**Files:**
- Modify: `App.tsx`

**Interfaces:**
- Produces modal handlers `handleCloudSendOtp(email)` and `handleCloudVerifyOtp(otp)`.

- [ ] Store pending OTP user ID and email in component state.
- [ ] On send, call `sendCloudEmailOtp`, store returned user ID, and show a message asking for the code.
- [ ] On verify, call `verifyCloudEmailOtp`, set `cloudUserEmail`, then run `runCloudSync()`.
- [ ] Keep sign-out clearing pending OTP state.
- [ ] Run `npx tsc --noEmit`.

### Task 4: Build and iOS Sync

**Files:**
- Update generated Capacitor iOS web assets via CLI.

- [ ] Run `npm run build`.
- [ ] Run `npx cap sync ios`.
- [ ] Confirm no unexpected source changes outside generated/native sync files.

### Task 5: End-to-End Verification

**Files:**
- No source edits.

- [ ] Start or reuse Vite dev server.
- [ ] Use Chrome to open `http://localhost:5173/`.
- [ ] Send Email OTP to the confirmed email.
- [ ] Ask user for the OTP code if it is not available in the browser context.
- [ ] Verify login and sync status.
- [ ] Check Appwrite rows after syncing a device that has local data.
