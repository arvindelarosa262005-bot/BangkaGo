# Verification status

Executed on 27 October 2026 (Asia/Singapore). The following base implementation results are followed by the subsequent Realtime/UI update below:

| Check                                         | Result                                                                                                               |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                           | Passed for admin and mobile applications                                                                             |
| `npm run typecheck:edge`                      | Passed for all Edge Function source using portable Deno declarations; actual Deno deployment still required          |
| `npm run build`                               | Passed with Vite 8.3.5; current admin bundle 621 kB before compression, with a chunk-size optimization warning       |
| `npm test`                                    | 24 tests passed: money, rounding, validation, booking transitions and raw-body webhook signatures                    |
| `npm run test:db`                             | 48 checks passed on actual embedded PostgreSQL with test-only Auth/Storage schema fixtures                           |
| Expo web export, one worker                   | Passed; all passenger and owner routes bundled. This is browser compilation, not an Android APK or device run        |
| Admin desktop and mobile-width browser checks | Passed; navigation, search/empty states, disabled configuration actions, no page errors or horizontal overflow       |
| Passenger browser preview                     | Passed onboarding, search empty state, My trips navigation, authentication configuration handling and no page errors |
| Formatting                                    | Passed Prettier check; modified files also formatted after visual adjustments                                        |

Local previews: admin http://127.0.0.1:5173 and passenger http://127.0.0.1:8082. These are local static previews of real application bundles in an explicit unconfigured state, not cloud deployments. No fake boats or successful payments are shown. The complete browser suite can be rerun after both bundles exist; the configuration starts local preview servers automatically if needed.

The initial install hit a full C: drive. Disposable npm download cache and this task's generated dependency directories were cleaned, followed by a clean successful installation of the compatible Expo 58 package set. Source files and personal data were preserved.

The locked dependency audit still reports **3 high-severity dependency entries** associated with Expo / its CLI / its transitive Zod 3 dependency. The applications and Edge Functions use Zod 4.6.7. No patched compatible Zod 3 release was available in the registry when checked; forcing an incompatible major into Expo internals is not treated as a verified fix. See `dependency-audit.json`. Resolve or formally review this release gate before pilot. No claim of a clean security audit is made.

Not executed: hosted Supabase authentication/email verification/storage/advisors, actual Android/iOS, independent-connection hosted contention, merchant sandbox GCash checkout/refund or real payout settlement. The opt-in hosted suite is present (`npm run test:hosted`) but was not run without a disposable BangkaGo project and credentials. The connected unrelated BeMIS project was not modified.

Remaining external and implementation gates: dedicated BangkaGo Supabase project; merchant sandbox keys and GCash eligibility; email delivery and deep links; device builds; independent-session concurrency; push/reminder delivery; provider failure/expiry worker; server-side large-volume reports; final operational/privacy policies. Provider fees are reconciled from canonical provider data and payout settlement is blocked while fees are unknown. Bank transfers remain a separate authorized manual process.

All stages have source implementation for the core workflow. The public pilot acceptance criteria remain incomplete until the external integration and device checks are performed.

## Realtime and visual update

The current source adds a sanitized Realtime signal publication, row triggers on all 21 application data tables, reconnect/network handling, timed availability/fee refreshes, an admin notifications inbox and refreshed maritime desktop/mobile interfaces. Both applications and Edge Function source passed TypeScript checks; the admin build and Expo web export completed. The current unit suite passed **36 tests**. The expanded PostgreSQL suite passed **61 checks**, including signal privacy, publication and trigger coverage, per-transaction deduplication, active/suspended role access, future fee activation and event retention.

All **4 final browser scenarios passed**: passenger desktop authentication/recovery/privacy navigation, desktop administration, mobile-width administration, and passenger onboarding/search/trips/password visibility/owner-role selection. Screenshots were visually reviewed. A browser test caught missing native-web checked-state metadata on role selectors; explicit ARIA aliases were added alongside native accessibility state and the complete suite passed after rebuilding. No horizontal overflow or page exceptions were detected. Formatting checks passed.

See [Realtime architecture, setup and testing](realtime.md) for exact coverage. Hosted two-session WebSocket delivery, physical Android connectivity and the merchant sandbox have not been executed. The user will create a new Supabase project in a different organization; activation awaits that project's URL and public configuration. The currently connected project is BeMIS and was not modified. Preview screenshots are saved in `docs/previews/`, including the new sign-in screen at `auth-desktop.png` and `auth-mobile.png`.
