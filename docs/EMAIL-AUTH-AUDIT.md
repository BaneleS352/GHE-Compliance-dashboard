# Employee-ID Email Authentication Audit

Audit date: 2026-11-23

## Scope

Employee-ID login and password recovery through the internal `EMAIL_API`, while preserving the Microsoft/Entra login path and the existing employee-ID form.

## Verification matrix

| Requirement | Evidence | Status |
|---|---|---|
| Microsoft/Entra button remains available | Browser login screen | Verified |
| Employee-ID form remains collapsible | Browser login screen | Verified |
| Employee OTP is delivered through the email API contract | `local-auth-recovery.test.ts`; `src/services/emailApi.ts` | Verified with mocked API |
| Password recovery uses registered email | `routes/auth.ts`; recovery test | Verified with mocked API |
| Generic recovery response prevents enumeration | Recovery test: 3/3 focused tests | Verified |
| OTP expiry and attempt limits remain enforced | `routes/auth.ts`; `local-auth-crypto.test.ts` | Verified in code/tests |
| Successful recovery resets throttles and records audit event | `routes/auth.ts` | Verified in code |
| Phone/SMS runtime path removed | Repository reference audit; migration `0026_remove_local_phone_auth` | Verified |
| Notification outbox can deliver through `EMAIL_API` | `emailOutboxWorker.ts`; successful `email:verify-api --send` | Verified at API boundary |
| TLS verification remains enabled | `emailApi.ts`; API test run with `NODE_TLS_REJECT_UNAUTHORIZED=1` | Verified |
| Real browser employee login sends and accepts an email OTP | Requires live submission | Pending confirmation |
| Real browser password enrollment/reset through the live API | Requires live OTP and live submission | Pending confirmation |

## Current known limitations

- The real browser flow has not been submitted because it sends an external email to the employee's registered address.
- SMTP code remains as a documented legacy fallback; `EMAIL_API` is the preferred delivery boundary.
- The old `/api/auth/local/inbox` endpoint is intentionally removed.

## Reproduction checks

```powershell
cd NodejsBackend
npm run email:verify-api
npm run email:verify-api -- --send --to=recipient@example.com
npx vitest run src/__tests__/local-auth-recovery.test.ts --reporter=dot
```
