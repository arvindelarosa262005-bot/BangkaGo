# BangkaGo implementation plan

The initial workspace was empty. All files are new; no existing application or data is replaced.

1. Workspace: npm monorepo, strict TypeScript, shared validation/design/financial types, separate Expo and Vite apps.
2. Database: relational tables, explicit grants and RLS, private document storage, transactional RPCs and audit records. All money uses integer centavos; basis points and half-up rounding.
3. Mobile: persistent authentication, onboarding, database search, details, checkout, passenger bookings, owner boats/schedules/requests, profile and support.
4. Administration: role gate, overview, registrations and private document review, users, bookings, finance, CSV reports and settings.
5. Booking/payment: boat-level locks, nonoverlapping schedules, atomic reservation, idempotency, expiry, provider checkout and authenticated webhook processing.
6. Ledger: immutable fare/commission snapshots, refunds and manually reconciled payouts, in-app notices.
7. Validation: build/type checks, financial tests and actual PostgreSQL migration/RLS/booking tests where a local runtime is available. External sandbox/device checks remain explicit gates.

Cloud deployment requires a dedicated BangkaGo Supabase project. The connected BeMIS project is unrelated and must not be modified. No merchant credentials are available. Payment configuration must fail closed.
