# Live updates and the refreshed interface

The passenger/owner application and admin console now use Supabase Realtime. They subscribe to **committed invalidation signals**, then refetch their own authorized database snapshots through TanStack Query. A WebSocket message never directly marks a booking paid or inserts an unverified financial value into the UI.

## Coverage

| Changes                                                                                | Views refreshed                                                                          |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Boats, owner verification, photos, documents, routes, locations, document requirements | Search, details, public availability, owner workspace, registration review and dashboard |
| Bookings, cancellations, confirmations and seat reservations                           | Passenger trips, owner requests/schedules, available seats and administration            |
| Verified payments, commissions, refunds and payouts                                    | Booking status, owner earnings, payment/finance lists and dashboard                      |
| Profiles and account restrictions                                                      | Current account/profile gate and permitted records                                       |
| Notifications and support tickets                                                      | In-app updates, admin notification inbox, support and unread counts                      |
| Saved boats, genuine reviews and application/commission settings                       | Relevant saved/listing/quote/settings views                                              |
| Admin decisions and audit records                                                      | Open records, document review history, audit list and registration status                |

There are row triggers on all 21 application data tables. Each transaction emits at most one signal per scope. A zero-row update emits no signal. Scopes are catalog, access, settings and account. A signal contains only a random ID, scope and timestamp; no booking IDs, identities, contact details, prices or document paths are published. Inactive or unauthenticated clients cannot read account-scope activity.

Private tables are deliberately removed from the Realtime publication. Postgres Changes DELETE delivery cannot safely apply ordinary record RLS; publishing only the signal table avoids exposing even private deletion keys. RLS still authorizes every subsequent snapshot query. Clients cannot insert their own signals or change a payment status.

The shared controller coalesces event bursts for 150 ms, refreshes after subscription/reconnection, removes channels and pending callbacks on account changes/unmount, and recovers after network loss or app foregrounding. Expo Network supplies native connectivity changes; browser online/offline events cover web. Token refresh updates Realtime authentication without clearing the user's entire cache. A bounded 60-second recovery refresh catches missed events; it is a fallback, not the primary live transport.

Time passing does not itself write a row. Public availability now returns `next_change_at`, the next hold expiry, departure or future fee-rule activation, without exposing a private reservation. Quotes also expose the next scheduled fee-change boundary. The controller schedules a refresh at that boundary. Unpaid holds display expired when their deadline passes; this display calculation never confirms payment or changes a paid booking. Price changes require renewed checkout-policy acknowledgment. The authenticated expiry worker normalizes stored booking states and prunes old signal/transaction bookkeeping rows.

## Activate on a dedicated BangkaGo project

1. Select the intended Supabase organization and a dedicated BangkaGo project. Do not use the unrelated BeMIS database.
2. Review and apply the new `20261027125208_bangkago_realtime.sql` migration after the core migration. It adds the signal table, private per-transaction deduplication, publication, triggers, health RPC, retention helper and revised availability RPC. Do not rerun or overwrite an already-applied core migration.
3. Configure the project URL and publishable key in each application's local environment. Restart/rebuild the applications to load them. Server/provider secrets must remain server-side.
4. Call `realtime_health`. It returns only a readiness boolean based on logical WAL, signal publication, absence of private table publication and all expected triggers. The UI reports **Live updates** only after this check succeeds and the channel receives SUBSCRIBED. Missing credentials show **Not connected**, missing database setup shows **Live setup required**, and transport failures show **Reconnecting** or **Offline**.
5. Deploy the revised expiry worker and run it once per minute with the private job token. It now also prunes events and deduplication bookkeeping older than one day. Read access to signals is limited to the latest 15 minutes.
6. Execute the opt-in hosted integration suite on a disposable test project, or verify two signed-in browser/device sessions manually. A cancellation in one passenger session must update public remaining seats in another, while the second passenger still cannot read the first passenger's booking. Admin decisions, financial verification and notification read state should update without manual refresh.

## What was verified locally

The database suite applies both migrations to actual embedded PostgreSQL and checks trigger coverage, publication restrictions, RLS, client signal-write denial, active/suspended roles, event privacy, per-transaction deduplication and retention, alongside the booking/finance tests. Unit tests use an explicitly fake transport to verify lifecycle, reconnection, coalescing, timeout state, expiry scheduling and cleanup. Browser tests verify the new desktop/mobile layouts and actual controls against compiled local bundles.

These are not proof of hosted Supabase WebSocket delivery. `scripts/test-hosted.mjs` now includes a real cross-session subscription, settings update, capacity-release signal and private-booking isolation check, but needs explicit test-project configuration. The user chose to create a new project in a different organization; its URL and public configuration are pending. The connected account currently exposes only BEMIS-Cloud, which was not modified or used for BangkaGo.

For larger deployments, replace broad active-view invalidation with scoped/private Broadcast and server-paginated aggregate queries after load testing. The current signals reveal only non-identifying activity timing, but all active authenticated views may refetch during an event burst. Profile/authorization reads remain authoritative and are refreshed after access changes.

## Interface changes

Responsive maritime sign-in/registration with an original boat illustration, password visibility controls, explicit passenger/owner selection, clearer recovery/privacy navigation, shared field focus and loading states, status colors, a cleaner search form and home illustration, larger readable admin tables/cards, and a real administrator notifications inbox. The illustration is decorative and never used as a fabricated listing photograph.

References: [Supabase Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes), [Realtime authorization](https://supabase.com/docs/guides/realtime/authorization), [Expo Network](https://docs.expo.dev/versions/latest/sdk/network/).
