import { serve, auth, checked, HttpError } from "../_shared/http.ts";
import { z } from "npm:zod@4.6.7";
const input = z.object({
  schedule_id: z.string().uuid(),
  passenger_count: z.number().int().min(1).max(200),
  idempotency_key: z.string().uuid(),
  policy_accepted: z.literal(true),
  instructions: z.string().max(500).default(""),
});
serve(async (req) => {
  const { client } = await auth(req);
  const parsed = input.safeParse(await req.json());
  if (!parsed.success)
    throw new HttpError(
      400,
      "Check trip details and accept the cancellation policy",
    );
  const v = parsed.data;
  return checked(
    await client.rpc("reserve_booking", {
      p_schedule: v.schedule_id,
      p_count: v.passenger_count,
      p_key: v.idempotency_key,
      p_instructions: v.instructions,
    }),
  );
});
