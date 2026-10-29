import { serve, auth, HttpError } from "../_shared/http.ts";
import { z } from "npm:zod@4.6.7";
serve(async (req) => {
  const { client } = await auth(req, true);
  const v = z
    .object({
      id: z.string().uuid(),
      reason: z.string().trim().min(5),
      bank_reference: z.string().trim().min(6),
    })
    .parse(await req.json());
  const { error } = await client.rpc("admin_action", {
    p_action: "payout_settle",
    p_id: v.id,
    p_data: { reason: v.reason, bank_reference: v.bank_reference },
  });
  if (error) throw new HttpError(400, error.message);
  return {
    status: "settled",
    workflow: "authorized_manual_bank_reconciliation",
  };
});
