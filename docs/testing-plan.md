# Testing plan

## Executable checks

`npm test`: integer money, rounding, commission allocation, schemas, restricted public role inputs, permitted booking transitions and HMAC verification.

`npm run test:db`: applies the deployment migration and seed to an actual embedded PostgreSQL engine (PGlite). Local test-only Auth and Storage schemas reproduce the required tables/functions; no network Auth or Storage is claimed. Role switching exercises real grants/RLS and booking/approval/payment/refund operations. Queued calls in one embedded connection do not prove independent-session concurrency.

`npm run typecheck`: strict TypeScript across the separate applications. `npm run build`: production admin bundle. Expo export validates browser/mobile module resolution separately. Physical Android UI and native storage/upload/notifications need an actual development build.

## Hosted integration and merchant E2E (required, not yet executed)

On an isolated, seeded BangkaGo test project, register passenger A and B and owner A and B using real email verification. Provision an administrator independently. Register boat and required documents; assert submission rejects missing/expired requirements. Approve and verify search visibility under anon/passenger. Try direct REST mutation attempts for each forbidden role.

Publish distinct future seat and charter schedules. Race two authenticated passenger reservations for the last seats from independent connections; sum of live reservations plus confirmed counts must never exceed capacity. Race same idempotency key, owner acceptance vs expiry, overlapping schedule writes, cancellation vs paid webhook and duplicate webhook delivery. Check transaction locks and duplicate ledger rows.

Complete a test GCash-capable hosted checkout using the merchant sandbox. Capture provider IDs and verify amount/currency/reference and server-confirmed status. Replay signed notification, send invalid signature/stale timestamp/mismatched environment and ensure no new payment/commission entry. Send paid event after expiry and confirm refund_pending without overbooking. Test a provider timeout after creation and safe reconciliation of the existing local claim.

Cancel a confirmed future trip; initiate and retrieve sandbox refund until succeeded. Confirm ledger reversal and no phantom owner payout. Complete another paid trip after arrival and verify owner estimated/verified/settled values independently. Test manual payout with an authorized bank reconciliation fixture clearly marked test, rather than moving real funds.

## Device and visual QA

Android: onboarding persistence, sign up/confirmation, sign in/recovery deep links, sign out and cache clearing, expired sessions, saved boats, trip search date in Philippine time, last-seat errors, owner upload and submit, booking action retries, offline/reconnect, hosted checkout return, notification permissions and contact calls. Accessibility: touch targets, screen reader labels, text scaling, contrast, focus and keyboard behavior. iOS is structured but requires its own device pass.

Admin: desktop/tablet/mobile layout, navigation, search/status filters/pagination, CSV sanitization, dialog focus, audit records, signed private documents, commission effective dates, payment/refund reconciliation. Totals must be migrated to server aggregation before exceeding API row limits.
