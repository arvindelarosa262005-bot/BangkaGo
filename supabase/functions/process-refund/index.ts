import { serve, auth, service, checked, HttpError } from "../_shared/http.ts";
import { PayMongo } from "../_shared/provider.ts";
import { z } from "npm:zod@4.6.7";
serve(async (req) => {
  const { user } = await auth(req, true);
  const { id, reason } = z
    .object({
      id: z.string().uuid(),
      reason: z.string().trim().min(5).max(2000),
    })
    .parse(await req.json());
  const db = service();
  let r = checked(await db.from("refunds").select("*").eq("id", id).single());
  const payment = checked(
    await db.from("payments").select("*").eq("id", r.payment_id).single(),
  );
  if (!payment.provider_payment_id)
    throw new HttpError(409, "Verified payment required");
  if (r.status === "confirmed") return { status: "confirmed" };
  const provider = new PayMongo();
  let result;
  if (r.provider_reference) {
    result = await provider.getRefund(r.provider_reference);
  } else {
    if (!checked(await db.rpc("claim_refund", { p_id: id })))
      throw new HttpError(
        409,
        "Refund already processing; reconcile the provider reference before retrying.",
      );
    result = await provider.refund(
      payment.provider_payment_id,
      Number(r.amount_minor),
      r.id,
    );
    checked(
      await db
        .from("refunds")
        .update({ provider_reference: result.id })
        .eq("id", r.id)
        .select()
        .single(),
    );
  }
  if (
    result.attributes.payment_id !== payment.provider_payment_id ||
    result.attributes.amount !== Number(r.amount_minor) ||
    (result.attributes.currency && result.attributes.currency !== "PHP")
  )
    throw new HttpError(409, "Provider refund mismatch");
  if (result.attributes.status === "succeeded") {
    const { error } = await db.rpc("confirm_refund", {
      p_id: r.id,
      p_reference: result.id,
      p_amount: result.attributes.amount,
    });
    if (error) throw new HttpError(400, error.message);
  }
  checked(
    await db
      .from("admin_audit_logs")
      .insert({
        actor_id: user.id,
        action: "refund.reconcile",
        target_id: id,
        reason,
        summary: {
          provider_reference: result.id,
          status: result.attributes.status,
        },
      })
      .select()
      .single(),
  );
  return { status: result.attributes.status };
});
