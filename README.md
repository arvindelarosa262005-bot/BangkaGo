# BangkaGo

Boat booking and operator management for Abra de Ilog, Occidental Mindoro, designed for additional Philippine locations. Blue and white Expo mobile app and a separate Vite administration app, backed by Supabase PostgreSQL/Auth/Storage/Edge Functions.

The refreshed mobile/admin interfaces include a shared live-update layer for bookings, availability, approvals, finances, notifications and settings. See [Realtime setup and verification](docs/realtime.md). A connected project and the new migration are required before live delivery can be activated; unconfigured previews show that status explicitly.

## Run

Requires Node 24 LTS and npm. From this directory:

```sh
npm ci
npm run dev:admin
npm run dev:mobile
```

Admin: http://localhost:5173. Mobile: Expo dev server; use an Android development build or compatible Expo Go. `npm run web -w @bangkago/mobile` opens a browser preview. Native notification support requires an EAS development build.

For Android phone testing, use `npm run dev:go` and scan its QR code inside Expo Go on the same Wi-Fi. [Expo Go and APK guide](docs/expo-go-android.md) explains phone testing, the configured APK preview profile, and the separate AAB profile for Google Play.

Copy each application's `.env.example` to `.env.local` and add the **dedicated BangkaGo** Supabase URL and publishable key. Missing configuration shows an explicit setup state, never invented records. Do not point this application at an unrelated project.

## Project map

- `apps/mobile`: passenger and role-specific owner experience, Expo Router, SecureStore-backed native sessions, React Hook Form/Zod, TanStack Query.
- `apps/admin-web`: administrator access gate, overview, boat review/private documents, people, bookings, payments/reconciliation, commissions, refunds, payouts, support, audit history, CSV export, configuration.
- `packages/shared`: reusable validation, UI tokens, money formatting and state transition definitions.
- `supabase/migrations`: deployable schema, restrictive grants/RLS, transaction-safe operations and private storage policies.
- `supabase/functions`: authenticated operations, provider boundary, signed webhooks, reconciliation and manual payout ledger.
- `scripts/test-database.mjs`: actual embedded PostgreSQL migration and role tests, using local Auth/Storage schema fixtures.
- `tests`: financial, validation and webhook signature checks.

## Verify

```sh
npm run typecheck
npm run build
npm test
npm run test:db
```

Browser preview checks: first build the admin and export the mobile web bundle (`npx expo export --platform web --max-workers 1` from `apps/mobile`), then run `npm run test:browser`. The runner uses the installed Microsoft Edge browser and Python 3 for local SPA preview servers. Install a Playwright Chromium browser and remove the channel override if Edge is unavailable. These checks exercise the unconfigured local setup state; the separate hosted integration suite is opt-in.

These checks do not replace hosted Supabase integration, independent-session concurrency tests, Android testing, or a merchant sandbox transaction. See [verification status](docs/verification-status.md).

## Configuration and deployment

Read [setup](docs/setup-guide.md), [architecture](docs/architecture.md), [database](docs/database-schema.md), [payments](docs/payment-integration.md), [security](docs/security-checklist.md), and [testing](docs/testing-plan.md).

The initial 10% commission is a **testing default**. Seeded geography and document requirements are development configuration, not a statement that any route or permit is approved for operation. No boats, users, ratings, payments or payouts are fabricated in development seed data.

## Pilot readiness

This source implementation requires its own Supabase project, email delivery/redirect setup, merchant eligibility and test keys, verified sandbox checkout/refund, live role/storage checks, device QA, operational document requirements and published business/privacy policies before a public pilot. Never describe a local build as a deployment or a checkout redirect as payment confirmation.
