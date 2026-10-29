import { applyVerifiedPayment } from "../_shared/verification.ts";
import { serve, service, auth, checked, HttpError } from "../_shared/http.ts";
import { PayMongo } from "../_shared/provider.ts";
import { z } from "npm:zod@4.6.7";
serve(async (req) => {
  const { user } = await auth(req, true);
  const { id } = z.object({ id: z.string().uuid() }).parse(await req.json());
  const db = service();
  const p = checked(
    await db.from("payments").select("*").eq("id", id).single(),
  );
  if (!p.provider_checkout_id)
    throw new HttpError(
      409,
      "Unknown provider outcome. Investigate the merchant dashboard before retrying checkout.",
    );
  const v = await new PayMongo().verifyCheckout(p.provider_checkout_id);
  if (!v) return { status: "not_paid" };
  const result = await applyVerifiedPayment("reconcile-" + v.payment, v);
  checked(
    await db
      .from("admin_audit_logs")
      .insert({
        actor_id: user.id,
        action: "payment.reconcile",
        target_id: id,
        reason: "Provider API verification",
      })
      .select()
      .single(),
  );
  return { status: result };
});
