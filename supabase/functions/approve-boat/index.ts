import { serve, auth, checked, HttpError } from "../_shared/http.ts";
import { z } from "npm:zod@4.6.7";
serve(async (req) => {
  const { client } = await auth(req, true);
  const v = z
    .object({
      boat_id: z.string().uuid(),
      status: z.enum([
        "approved",
        "rejected",
        "needs_correction",
        "suspended",
        "under_review",
      ]),
      reason: z.string().trim().min(5).max(2000),
    })
    .safeParse(await req.json());
  if (!v.success)
    throw new HttpError(400, "Valid review decision and reason required");
  const { error } = await client.rpc("review_boat", {
    p_id: v.data.boat_id,
    p_status: v.data.status,
    p_reason: v.data.reason,
  });
  if (error) throw new HttpError(400, error.message);
  return { saved: true };
});
