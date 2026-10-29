import { applyVerifiedPayment } from "../_shared/verification.ts";
import { serve, service, checked, env, HttpError } from "../_shared/http.ts";
import { PayMongo, validSignature, mode } from "../_shared/provider.ts";
serve(async (req) => {
  const raw = await req.text();
  if (raw.length > 262144) throw new HttpError(413, "Payload too large");
  if (
    !(await validSignature(
      raw,
      req.headers.get("Paymongo-Signature") || "",
      env("PAYMONGO_WEBHOOK_SECRET"),
      mode() === "live",
    ))
  )
    throw new HttpError(401, "Invalid webhook signature");
  const payload = JSON.parse(raw);
  const event = payload.data;
  const type = event?.attributes?.type ?? event?.type;
  if (type !== "checkout_session.payment.paid") return { ignored: true };
  const checkout = event.attributes?.data?.id ?? event.data?.id;
  if (
    typeof event.id !== "string" ||
    !/^evt_[\w]+$/.test(event.id) ||
    typeof checkout !== "string"
  )
    throw new HttpError(400, "Invalid event");
  const verified = await new PayMongo().verifyCheckout(checkout);
  if (!verified) throw new HttpError(409, "Provider has not confirmed payment");
  const result = await applyVerifiedPayment(event.id, verified);
  return { status: result };
}, true);
