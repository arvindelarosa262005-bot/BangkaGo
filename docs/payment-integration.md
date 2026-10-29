# Payment and finance

PayMongo is behind a PaymentProvider interface. This implementation uses hosted Checkout v2 with GCash as the configured method; merchant approval and channel availability must be confirmed for the account. Xendit can be added by implementing the same create/verify interface plus its own authenticated webhook contract. No direct GCash merchant access or automatic split settlement is assumed.

1. Passenger sees a backend quote, accepts policy and creates an atomic reservation.
2. Operator accepts before the 30-minute hold expires.
3. create-payment-checkout validates the signed-in passenger and booking, creates one local payment, claims it once and calls PayMongo using a server secret and persisted idempotency reference.
4. Passenger opens PayMongo's checkout. Return pages merely tell them to refresh My trips.
5. payment-webhook verifies the raw-body HMAC SHA256 with Paymongo-Signature, choosing te for test and li for live, and a five-minute timestamp tolerance.
6. Server retrieves the canonical Checkout Session using its secret and validates environment and the one paid payment. The database checks exact centavos, PHP currency and local checkout association, then atomically records event/payment/commission and confirms only an eligible hold.
7. Late payments are recorded as paid but booking goes to refund_pending. Seats are not reallocated to the late payer.

If the gateway call times out after creating a session/refund, the durable claim prevents an automatic duplicate. Investigate the merchant dashboard using the local reference. A server operator must reconcile the provider identifier on the existing record after verifying ownership/amount/currency, record an audit entry, and invoke reconciliation. Never create a second checkout to conceal an uncertain result. Orphaned signed webhooks are rejected and retried until association is repaired.

Admin Payments → reconcile queries PayMongo; it never accepts a typed paid amount. Checkout failure/expiry statuses exist in the model but automatic failed-attempt/expiry reconciliation is an outstanding integration item. Pending attempts do not reserve capacity beyond booking expiry. PayMongo Checkout Sessions need explicit expiry; schedule provider expiry/reconciliation before public launch to reduce unnecessary late refunds.

Refunds are full fare including passenger service fee. Admin initiates provider refunds once; subsequent checks retrieve the existing refund. Only provider `succeeded` status and exact reference/amount permit confirmed refund and ledger reversal. Asynchronous updates are currently refreshed by administrator reconciliation, not a separate refund webhook worker. Failed or unknown refund outcomes require investigation. Historical commissions are immutable; refund adjustment records reverse them.

Payouts are created only after an operator completes a confirmed trip after its arrival time. Canonical provider processing fees, when returned, are recorded on the ledger and deducted from operator payable. Unknown fees remain null; settlement is blocked until a provider fee is reconciled. Repeated verification accepts the same fee and rejects changed fees for investigation. An administrator records a real, separately verified bank reference and reason. This is an authorized manual ledger workflow; the software does not send funds. A settled trip cannot be refunded through the routine passenger cancellation flow. Before pilot, finance must approve the allocation policy and bank reconciliation under a documented two-person procedure.

## Configuration

PAYMENT*MODE=test, PAYMONGO_SECRET_KEY=sk_test*…, PAYMONGO_WEBHOOK_SECRET, CHECKOUT_SUCCESS_URL and CHECKOUT_CANCEL_URL (HTTPS). All live/test modes must match. Subscribe the public payment-webhook URL to checkout_session.payment.paid. Gateway JWT validation is disabled only because provider authentication is the signature. Use approved HTTPS return pages that display no success assumption and direct users to My trips.

## Primary references checked during implementation

- [PayMongo Checkout quick start](https://docs.paymongo.com/docs/payment-channels-hosted-checkout-quick-start)
- [Webhook signature verification](https://docs.paymongo.com/docs/developer-tools-webhook-setup-management)
- [Checkout Session resource](https://docs.paymongo.com/reference/checkout-session-resource)
- [Refunds](https://docs.paymongo.com/docs/payment-acceptance-refunds)

No real or sandbox payment has been completed without merchant credentials. Provider contract tests use explicit test fixtures and cannot establish merchant/channel eligibility.
