import { env, HttpError } from "./http.ts";
export interface ProviderCheckout {
  id: string;
  url: string;
  live: boolean;
}
export interface VerifiedPayment {
  checkout: string;
  payment: string;
  amount: number;
  currency: string;
  reference: string;
  fee?: number;
}
export interface PaymentProvider {
  createCheckout(
    id: string,
    amount: number,
    key: string,
  ): Promise<ProviderCheckout>;
  verifyCheckout(id: string): Promise<VerifiedPayment | null>;
}
export function mode() {
  const mode = env("PAYMENT_MODE");
  if (mode !== "test" && mode !== "live")
    throw new HttpError(503, "Invalid payment environment");
  return mode;
}
async function request(
  path: string,
  method = "GET",
  body?: unknown,
  key?: string,
) {
  const secret = env("PAYMONGO_SECRET_KEY");
  if (!secret.startsWith(mode() === "live" ? "sk_live_" : "sk_test_"))
    throw new HttpError(503, "Payment key and environment do not match");
  const response = await fetch("https://api.paymongo.com/" + path, {
    method,
    headers: {
      Authorization: "Basic " + btoa(secret + ":"),
      "Content-Type": "application/json",
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok)
    throw new HttpError(
      502,
      "Payment provider could not complete the request. Reconciliation may be required.",
    );
  return (await response.json()).data;
}
function https(key: string) {
  const value = env(key);
  if (new URL(value).protocol !== "https:")
    throw new HttpError(503, "Checkout return URLs must use HTTPS");
  return value;
}
export class PayMongo implements PaymentProvider {
  async createCheckout(id: string, amount: number, key: string) {
    const data = await request(
      "v2/checkout_sessions",
      "POST",
      {
        data: {
          attributes: {
            line_items: [
              {
                name: "BangkaGo boat booking",
                amount,
                currency: "PHP",
                quantity: 1,
              },
            ],
            payment_method_types: ["gcash"],
            reference_number: id,
            success_url: https("CHECKOUT_SUCCESS_URL"),
            cancel_url: https("CHECKOUT_CANCEL_URL"),
            description: "Boat transportation booking",
            show_line_items: true,
          },
        },
      },
      key,
    );
    if (
      data.attributes.livemode !== (mode() === "live") ||
      new URL(data.attributes.checkout_url).hostname !== "checkout.paymongo.com"
    )
      throw new HttpError(502, "Invalid checkout response");
    return {
      id: data.id,
      url: data.attributes.checkout_url,
      live: data.attributes.livemode,
    };
  }
  async verifyCheckout(id: string) {
    if (!/^cs_[\w]+$/.test(id))
      throw new HttpError(400, "Invalid checkout identifier");
    const data = await request("v2/checkout_sessions/" + id);
    if (data.id !== id || data.attributes.livemode !== (mode() === "live"))
      throw new HttpError(400, "Checkout environment mismatch");
    const payments = data.attributes.payments ?? [];
    const paid = payments.filter((p: any) => p.attributes.status === "paid");
    if (paid.length === 0) return null;
    if (paid.length !== 1)
      throw new HttpError(
        409,
        "Multiple payments require finance investigation",
      );
    const p = paid[0];
    if (
      p.attributes.livemode !== undefined &&
      p.attributes.livemode !== (mode() === "live")
    )
      throw new HttpError(400, "Payment environment mismatch");
    if (!Number.isSafeInteger(p.attributes.amount) || p.attributes.amount <= 0)
      throw new HttpError(400, "Invalid provider amount");
    return {
      checkout: id,
      payment: p.id,
      amount: p.attributes.amount,
      currency: p.attributes.currency,
      reference: data.attributes.reference_number,
      ...(Number.isSafeInteger(p.attributes.fee)
        ? { fee: p.attributes.fee }
        : {}),
    };
  }
  async refund(payment: string, amount: number, key: string) {
    return request(
      "v1/refunds",
      "POST",
      {
        data: {
          attributes: {
            payment_id: payment,
            amount,
            reason: "requested_by_customer",
          },
        },
      },
      key,
    );
  }
  async getRefund(id: string) {
    if (!/^ref_[\w]+$/.test(id))
      throw new HttpError(400, "Invalid refund identifier");
    return request("v1/refunds/" + id);
  }
}
export { validSignature } from "./signature.ts";
