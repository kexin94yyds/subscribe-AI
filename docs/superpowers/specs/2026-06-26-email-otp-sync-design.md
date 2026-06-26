# Email OTP Sync Design

## Goal

Make MonoExpire cloud sync usable on both desktop web and the iOS Capacitor app by adding an Appwrite Email OTP login flow while keeping the existing Magic URL callback path for web compatibility.

## Approach

Email OTP becomes the primary sign-in flow in the sync modal. A user enters an email, receives a short code, enters the code in the app, and the app creates an Appwrite session with `Account.createSession({ userId, secret: otp })`. This avoids mobile deep-link requirements for Magic URL callbacks.

The existing Magic URL handling remains in `cloudSyncService.ts` so previously sent desktop links still work. If a Magic URL callback arrives after a session is already active, the app clears the callback parameters and continues with the existing session.

## Files

- `services/cloudSyncService.ts`: expose Email OTP send and verify helpers.
- `components/SyncModal.tsx`: add the two-step OTP UI.
- `App.tsx`: coordinate OTP send, OTP verify, and post-login sync.
- `package.json`: add a minimal test runner if needed for focused behavior tests.
- `ios/`: receive updated Capacitor web assets through `npx cap sync ios`.

## Verification

- TypeScript: `npx tsc --noEmit`
- Production build: `npm run build`
- iOS asset sync: `npx cap sync ios`
- Desktop Web: log in with Email OTP, sync, and confirm account status.
- Appwrite Console: confirm rows appear when a device with local data syncs.

## Constraints

- Do not remove Magic URL compatibility.
- Do not require mobile email links to jump back into the app.
- Preserve existing local data merge behavior.
- Avoid broad UI redesign; only adjust sync modal login controls.
