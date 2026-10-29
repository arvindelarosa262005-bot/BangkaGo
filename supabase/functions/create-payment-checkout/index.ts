import {
  serve,
  auth,
  checked,
  service,
  HttpError,
  env,
} from "../_shared/http.ts";
import { PayMongo } from "../_shared/provider.ts";
import { z } from "npm:zod@4.6.7";
serve(async (req) => {
  const { user } = await auth(req);
  const { booking_id } = z
    .object({ booking_id: z.string().uuid() })
    .parse(await req.json());
  env("PAYMONGO_SECRET_KEY");
  const db = service();
  const payment = checked(
    await db.rpc("prepare_checkout", {
      p_user: user.id,
      p_booking: booking_id,
    }),
  );
  if (payment.checkout_url) return { checkout_url: payment.checkout_url };
  if (!checked(await db.rpc("claim_checkout", { p_id: payment.id })))
    throw new HttpError(
      409,
      "Checkout is being prepared or needs reconciliation. Refresh before trying again.",
    );
  // A timeout leaves the durable claim pending. Do not create another provider session.
  const session = await new PayMongo().createCheckout(
    booking_id,
    Number(payment.amount_minor),
    payment.idempotency_key,
  );
  const { error } = await db
    .from("payments")
    .update({ provider_checkout_id: session.id, checkout_url: session.url })
    .eq("id", payment.id)
    .is("provider_checkout_id", null);
  if (error)
    throw new HttpError(
      503,
      "Checkout created; reconciliation is required before retrying",
    );
  return { checkout_url: session.url };
});
