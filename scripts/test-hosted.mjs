/** Explicit opt-in: creates fixture accounts and records on a disposable hosted project. */
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
const url = process.env.TEST_SUPABASE_URL,
  key = process.env.TEST_SUPABASE_PUBLISHABLE_KEY,
  secret = process.env.TEST_SUPABASE_SECRET_KEY;
if (
  process.env.BANGKAGO_ALLOW_TEST_ACCOUNT_CREATION !== "1" ||
  !url ||
  !key ||
  !secret
) {
  console.error(
    "Not run: set the TEST_SUPABASE variables and BANGKAGO_ALLOW_TEST_ACCOUNT_CREATION=1 for a disposable BangkaGo project. This creates retained test records.",
  );
  process.exit(2);
}
const server = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const tag = crypto.randomUUID().slice(0, 8);
const password = crypto.randomUUID() + "Aa!";
async function account(name, role) {
  const email = `bangkago-${tag}-${name}@example.com`;
  const { data, error } = await server.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: "TEST " + name, role },
  });
  if (error) throw error;
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const result = await client.auth.signInWithPassword({ email, password });
  if (result.error) throw result.error;
  return { id: data.user.id, client };
}
async function rpc(client, name, args = {}) {
  const { data, error } = await client.rpc(name, args);
  if (error) throw error;
  return data;
}
const owner = await account("owner", "owner"),
  other = await account("other-owner", "owner"),
  admin = await account("admin-attempt", "admin");
assert.equal(
  (await admin.client.from("profiles").select("role").single()).data.role,
  "passenger",
);
const promote = await server
  .from("profiles")
  .update({ role: "admin" })
  .eq("id", admin.id);
if (promote.error) throw promote.error;
const passengers = await Promise.all(
  Array.from({ length: 4 }, (_, i) => account("passenger" + i, "passenger")),
);
const locations = await server.from("locations").select("*").limit(1);
const routes = await server.from("routes").select("*").limit(1);
assert.ok(
  locations.data?.[0] && routes.data?.[0],
  "Apply geography seed before test",
);
const boat = await rpc(owner.client, "save_boat", {
  p_data: {
    name: "TEST " + tag,
    description: "Disposable hosted integration fixture",
    boat_type: "motorized_bangka",
    capacity: 2,
    home_location_id: locations.data[0].id,
    seat_price_minor: 10000,
    charter_price_minor: 20000,
  },
});
const requirements = await server.from("document_requirements").select("*");
const png = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1cAAAAASUVORK5CYII=",
    "base64",
  ),
);
for (const requirement of requirements.data ?? []) {
  const path = `${owner.id}/${boat}/${crypto.randomUUID()}.png`;
  const uploaded = await owner.client.storage
    .from("boat-documents")
    .upload(path, png, { contentType: "image/png" });
  if (uploaded.error) throw uploaded.error;
  await rpc(owner.client, "add_attachment", {
    p_boat: boat,
    p_path: path,
    p_requirement: requirement.id,
  });
  assert.ok(
    (
      await other.client.storage
        .from("boat-documents")
        .createSignedUrl(path, 30)
    ).error,
    "Other owner must not sign private document",
  );
}
await rpc(owner.client, "submit_boat", { p_id: boat });
assert.ok(
  (
    await owner.client.rpc("review_boat", {
      p_id: boat,
      p_status: "approved",
      p_reason: "TEST forbidden self approval",
    })
  ).error,
);
await rpc(admin.client, "review_boat", {
  p_id: boat,
  p_status: "approved",
  p_reason: "TEST hosted fixture approval only",
});
const schedule = await rpc(owner.client, "save_schedule", {
  p_data: {
    boat_id: boat,
    route_id: routes.data[0].id,
    starts_at: new Date(Date.now() + 86400000).toISOString(),
    ends_at: new Date(Date.now() + 90000000).toISOString(),
    mode: "seat",
    capacity: 2,
    price_minor: 10000,
  },
});
const results = await Promise.allSettled(
  passengers.map((p) =>
    rpc(p.client, "reserve_booking", {
      p_schedule: schedule,
      p_count: 1,
      p_key: crypto.randomUUID(),
    }),
  ),
);
assert.equal(
  results.filter((r) => r.status === "fulfilled").length,
  2,
  "Exactly two independent sessions must reserve the two seats",
);
assert.equal(results.filter((r) => r.status === "rejected").length, 2);
const rows = await server
  .from("bookings")
  .select("*")
  .eq("schedule_id", schedule);
assert.equal(
  rows.data.reduce((n, b) => n + b.passenger_count, 0),
  2,
);
const first = results.find((r) => r.status === "fulfilled").value;
assert.ok(
  (await other.client.from("bookings").select("*").eq("id", first.id)).data
    .length === 0,
);
const wrongUpdate = await passengers[0].client
  .from("profiles")
  .update({ role: "admin" })
  .eq("id", passengers[0].id);
assert.ok(wrongUpdate.error);
// Actual cross-session WebSocket delivery: no mocked messages or fabricated provider events.
assert.equal(
  (await rpc(passengers[0].client, "realtime_health")).ready,
  true,
  "Apply the Realtime migration and enable logical replication before this test",
);
const observer = passengers.find((p) => p.id !== first.passenger_id);
const observed = [];
const live = observer.client
  .channel("TEST-live-" + tag)
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "live_events" },
    (payload) => observed.push(payload),
  );
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Hosted Realtime subscription timed out")),
      15000,
    );
    live.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        clearTimeout(timer);
        resolve();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        clearTimeout(timer);
        reject(new Error("Hosted Realtime subscription failed"));
      }
    });
  });
  async function waitForScope(scope, after) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const event = observed.slice(after).find((e) => e.new.scope === scope);
      if (event) {
        assert.deepEqual(Object.keys(event.new).sort(), [
          "created_at",
          "id",
          "scope",
        ]);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("No " + scope + " signal received across hosted sessions");
  }
  let after = observed.length;
  await rpc(admin.client, "configure_platform", {
    p_kind: "setting",
    p_data: {
      key: "privacy_contact",
      value: "TEST-" + tag,
      reason: "TEST Realtime settings delivery",
    },
  });
  await waitForScope("settings", after);
  assert.equal(
    (
      await observer.client
        .from("app_settings")
        .select("value")
        .eq("key", "privacy_contact")
        .single()
    ).data.value,
    "TEST-" + tag,
  );
  after = observed.length;
  const requester = passengers.find((p) => p.id === first.passenger_id);
  await rpc(requester.client, "booking_action", {
    p_id: first.id,
    p_action: "cancel",
    p_reason: "TEST Realtime capacity release",
  });
  await waitForScope("catalog", after);
  assert.equal(
    (await rpc(observer.client, "available_schedules")).find(
      (s) => s.id === schedule,
    ).remaining,
    1,
  );
  assert.equal(
    (await observer.client.from("bookings").select("*").eq("id", first.id)).data
      .length,
    0,
    "Availability changes must not reveal another passenger booking",
  );
  console.log(
    "PASS hosted cross-session Realtime settings, seat release and private-booking isolation.",
  );
} finally {
  await observer.client.removeChannel(live);
}
console.log(
  "PASS hosted Auth login, role mapping, real private storage isolation, boat submission/approval, independent-session seat contention, booking RLS and role mutation denial.",
);
console.log(
  "Retained TEST fixture boat:",
  boat,
  "; no accounts or financial records were deleted.",
);
console.log(
  "Payment checkout/GCash completion/refund still require the merchant sandbox E2E described in docs/testing-plan.md.",
);
