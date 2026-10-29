import { serve, checked, service, env, HttpError } from "../_shared/http.ts";
serve(async (req) => {
  if (
    req.headers.get("Authorization") !==
    "Bearer " + env("RESERVATION_JOB_SECRET")
  )
    throw new HttpError(401, "Job authorization required");
  const db = service();
  return {
    expired: checked(await db.rpc("expire_reservations")),
    pruned: checked(await db.rpc("prune_live_events")),
  };
});
