# Milestone 4.1 — Runbook Addendum (maintainer-run)

Additive to `2026-07-14-milestone-4-runbook.md`. Covers only what changed in the
4.1 QA pass. **No new migrations, edge functions, or cron jobs this pass.** The
only backend-adjacent action is a **Supabase Auth dashboard change for password
reset (D4)** — do NOT let this agent apply it; apply it yourself in the dashboard.

Project ref: `qccgshanmoeybagxwvcs`.

---

## D4 — Password reset opens `http://localhost:3000` instead of the app

### Root cause
`http://localhost:3000` is the Supabase project's **default Site URL**. Supabase
uses the Site URL as the fallback whenever the `redirect_to` it receives is **not
in the Redirect-URLs allow-list**. The app was building the native `redirectTo`
with `Linking.createURL('/reset-password')`, which resolves to a **dev-client /
Expo-Go-flavoured URL** during on-device QA (e.g. `exp+sanadmobile://…` or a
`…/--/reset-password` dev-server URL) — that value is not allow-listed, so
Supabase dropped it and fell back to the Site URL (`http://localhost:3000`).

### Code fix (already in this branch — no action needed)
The app now sends the **exact literal** native deep link
`sanadmobile://reset-password` (see `src/features/auth/password-reset.ts` →
`RESET_PASSWORD_DEEP_LINK` / `passwordResetRedirectTo`). The `sanadmobile` scheme
is registered in `app.json` (`expo.scheme`), and `/reset-password` is a root
route **outside** the auth guard, so the recovery link resolves in-app on both
cold start and warm app.

### Dashboard steps you must apply (Authentication → URL Configuration)
This is a **native-first app with no hosted web build**. Set both:

1. **Redirect URLs** — must contain the exact value the app now sends:
   ```
   sanadmobile://reset-password
   ```
   (Optionally also add `sanadmobile://**` to cover current/future app deep links
   such as the WhatsApp join link. The join link does **not** strictly need
   allow-listing — it's a plain app link, not an Auth redirect — but a wildcard is
   harmless and future-proofs other Auth flows.)

2. **Site URL** — change it away from the `http://localhost:3000` default so the
   *fallback* also opens the app instead of a dead localhost page:
   ```
   sanadmobile://reset-password
   ```
   (A scheme root like `sanadmobile://` is also acceptable if you prefer a generic
   fallback for other Auth emails. The important thing is that it is **not**
   `http://localhost:3000`.)

No email-template change is required — the default `{{ .ConfirmationURL }}`
carries the verified `redirect_to` through the `/auth/v1/verify` hop, which then
302-redirects to `sanadmobile://reset-password#access_token=…&type=recovery`
(implicit) or `…?code=…` (PKCE). `src/app/reset-password.tsx` already parses both.

### Post-apply verification (on device, per the QA checklist)
- Sign-in → «نسيت كلمة المرور؟» → enter email → confirmation shown.
- The recovery email link opens the app at `/reset-password` (test **cold start**
  and **app already open**) — it must **not** open `http://localhost:3000`.
- Set a new password → succeeds → sign in with it.
- Expired/garbled link → the "invalid link" state with "request a new link".

---

## Everything else in 4.1 is client-side

- **D1 / D2 / D3** (Pulse refresh, today-scope + rename to «سجل النشاط», masdar
  headlines + corrected share) are pure client changes — no backend action.
- **D5** (claim-control contrast) is styling only.
- **F1** (preserve the join code across the auth gate) is client-side; the
  WhatsApp join deep link still needs no Auth allow-listing.
- **F3** (digest hour named constant) is a comment/refactor in
  `send-daily-summaries` — **no redeploy is required for correctness** (behaviour
  is unchanged: still fires at circle-local 20:00). Redeploy only if/when you next
  ship that function for another reason.
- **F2** (regenerated Supabase types) was **not** performed — see the fixes report.
