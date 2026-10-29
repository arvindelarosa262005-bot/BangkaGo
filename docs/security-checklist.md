# Security checklist and evidence boundaries

Checked by automated local PostgreSQL tests: public registration cannot create admins; self role updates are denied; owners cannot approve boats; another owner cannot edit/read private registration data; passengers cannot see others' bookings or profiles; anonymous roles cannot read private profiles/payments; payments cannot be changed by clients; provider amount/currency mismatch rejects confirmation; duplicate webhook/checkout keys are idempotent; every exposed table has RLS; suspension removes listings; capacity and overlap checks reject invalid requests.

Before pilot, execute and retain evidence for these checks on the dedicated **hosted Supabase** project:

- Auth email verification, password recovery, expired/revoked sessions, active-account checks, CAPTCHA and Auth throttling. Verify deep links on the actual Android build.
- Direct REST/RPC requests under anon, passenger A/B, owner A/B, admin, suspended users, expired JWT and service role. A hidden button is not authorization.
- Private bucket download/signing denied to unrelated users and anonymous callers. Confirm photo access only for approved active boats. Test MIME/size restrictions and document attachment integrity. Add malware scanning before allowing production document uploads if the operating policy requires it.
- RPC EXECUTE grants and private schema exposure; no private schema in PostgREST API schemas; no SECURITY DEFINER view/function leakage. Review advisors in the actual project.
- No service/provider keys in bundles, logs or repository. Public environment examples contain no credentials. Review build secrets and HTTPS/CSP headers at hosting boundary.
- Cross-origin requests reject unknown origins; API request body limits and persistent user rate limits. Add edge-level/IP controls for unauthenticated provider endpoints.
- Payment raw-body signature, wrong environment, stale/replayed timestamps, amount/currency/checkout mismatch and duplicate provider deliveries. Test timeouts, lost replies and retry/reconciliation behavior using merchant sandbox.
- Independent-connection concurrent seat reservations and concurrent overlapping schedule creation. Confirm exactly one charter wins and capacity never goes below zero.
- Refund verification and settled-payout protections; review manual bank-reference reconciliation with finance. Reconcile real provider fees before authorizing actual payout values.
- Signed document URLs expire; browsers use noopener. CSV formula-injection escaping and role access.
- Notifications respect operational preferences during push delivery; in-app financial history may still be retained. No verified-payment notification before server confirmation.
- Data minimization/retention and authorized account closure. Published operating entity and privacy contact. Audit entries retain reasons without secrets or unnecessary documents.

Do not equate local engine tests or RLS enabled with a complete security assessment. Review dependency audit status in verification-status.md and rerun npm audit on the locked package set before release.
