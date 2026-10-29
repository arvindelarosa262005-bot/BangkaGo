# Setup and deployment

## Local development

1. Install Node 24 LTS and npm, then `npm ci` at the repository root.
2. Copy `apps/admin-web/.env.example` and `apps/mobile/.env.example` to `.env.local` in their own app directories. Use a dedicated BangkaGo project's URL/publishable key. Never copy a service key into a client variable.
3. Docker Desktop is required for the complete local Supabase stack. Run `npx supabase --help`, `npx supabase start --help`, then `npm run db:start`. Inspect `npx supabase status` to obtain local public configuration.
4. On a **new disposable local database only**, `npm run db:reset` applies migrations and seed. This resets local data; do not run a reset on a database containing work you need to keep.
5. Run `npm run dev:admin` and `npm run dev:mobile` in separate terminals. Mobile browser preview: `npm run web -w @bangkago/mobile`. Use a LAN-accessible Supabase URL on a physical Android phone; localhost on a phone refers to the phone itself.

## Dedicated hosted project

Create or select a dedicated BangkaGo project. The connected BEMIS-Cloud project is unrelated. Inspect any existing schema before applying migrations. Run `npx supabase link --help`, link the intended project, inspect `npx supabase db push --help`, review the migration and apply it. Run the geography/commission seed only after reviewing its development defaults; never seed a real route as operational without authorization.

Apply both the core and Realtime migrations before connecting clients or deploying the expiry worker. [Realtime activation](realtime.md) describes the signal-only publication, readiness check and live verification. Do not manually publish private application tables; only `public.live_events` belongs in this application's Realtime publication.

Enable email confirmation, configure SMTP for production, set site URL and redirect allowlists for the admin domain and `bangkago://auth`, and test signup/confirmation/recovery on Android. Passwords must contain at least 10 characters at the Auth service as well as client validation. Enable CAPTCHA and Auth rate controls appropriate to the launch environment. Configure deep links/app association for production mobile builds.

The first administrator must be an existing verified Auth user. An authorized project operator can run this reviewed query, substituting the actual account UUID (never use registration metadata):

```sql
update public.profiles set role = 'admin' where id = 'VERIFIED_USER_UUID';
```

Do not expose role provisioning as a public form. Privileged role changes need a separate audited operator procedure.

## Edge Functions

Inspect `npx supabase functions deploy --help` and `npx supabase secrets set --help`. Set the server-only variables in the root `.env.example` using Supabase secrets; never commit populated env files. The platform supplies SUPABASE_URL and the server credentials. The functions support both modern SUPABASE_SECRET_KEY/PUBLISHABLE_KEY and legacy SERVICE_ROLE_KEY/ANON_KEY variables.

Deploy create-booking, approve-boat, create-payment-checkout, payment-webhook, reconcile-payment, process-refund, process-payout, expire-reservations. The functions authenticate user requests themselves through Auth getUser and active database profiles. JWT gateway validation is disabled in config to support publishable keys; **do not remove the in-handler checks**. The webhook uses a provider signature and the expiry job uses RESERVATION_JOB_SECRET, never a public client token.

Set ALLOWED_ORIGINS to exact production/admin browser origins and preview origins you control. Add the mobile web origin if used. Native requests have no browser Origin. Schedule expire-reservations once per minute with the private job token. Monitor failed/late payments and pending refunds; configure a retention job for private.rate_limits.

## Web and Android release

`npm run build` produces `apps/admin-web/dist`; host over HTTPS with SPA fallback to index.html, restrictive CSP, HSTS and nosniff. Allow only required Supabase HTTPS/WSS connections and approved image hosts. Set VITE public variables at build time. Never deploy a Vite development server as production hosting.

Use an EAS project and development build for native notifications. Set EXPO_PUBLIC_EAS_PROJECT_ID, configure Android notification credentials and register the resulting token. A push-delivery worker is still required; saving a token does not send notifications. Build Android with EAS after reviewing identifiers and signing ownership. Physical-device auth, deep links, uploads, connectivity and payment-return tests are release gates. iOS packaging, signing and store compliance require a separate device validation pass.

## Required external configuration

- Dedicated Supabase project, SMTP, allowed redirects and operator-provisioned administrator.
- Merchant-approved PayMongo account, GCash channel eligibility, test secret, webhook secret, HTTPS success/cancel pages.
- Operational route approval and applicable vessel/permit/safety requirements confirmed with the relevant authorities.
- Privacy/terms operating entity and contact, business cancellation policy, support process.
- Authorized bank reconciliation and finance controls for payouts.
- Optional EAS credentials plus push/reminder delivery worker.
