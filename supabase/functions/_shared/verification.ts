import { service, checked, HttpError } from "./http.ts";
import type { VerifiedPayment } from "./provider.ts";
export async function applyVerifiedPayment(
  event: string,
  verified: VerifiedPayment,
) {
  const db = service();
  const payment = checked(
    await db
      .from("payments")
      .select("id,booking_id,status")
      .eq("provider_checkout_id", verified.checkout)
      .single(),
  );
  if (verified.reference !== payment.booking_id)
    throw new HttpError(409, "Provider booking reference mismatch");
  const result = checked(
    await db.rpc("verify_payment", {
      p_event: event,
      p_checkout: verified.checkout,
      p_provider_payment: verified.payment,
      p_amount: verified.amount,
      p_currency: verified.currency,
    }),
  );
  if (verified.fee !== undefined && payment.status !== "refunded") {
    const { error } = await db.rpc("record_provider_fee", {
      p_payment: payment.id,
      p_fee: verified.fee,
    });
    if (error)
      throw new HttpError(
        409,
        "Payment recorded; processing fee requires finance investigation",
      );
  }
  return result;
}
