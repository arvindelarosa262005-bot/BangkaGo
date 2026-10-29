import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import assert from "node:assert/strict";
const db = new PGlite();
let passed = 0;
const uid = (n) => `${String(n).padStart(8, "0")}-0000-4000-8000-000000000001`;
async function as(role, id) {
  await db.exec(
    `reset role;select set_config('request.jwt.claim.sub','${id ?? ""}',false);set role ${role};`,
  );
}
async function q(sql, args = []) {
  return (await db.query(sql, args)).rows;
}
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log("PASS " + name);
  } catch (e) {
    console.error("FAIL " + name + ": " + e.message);
    throw e;
  }
}
async function fails(sql, pattern) {
  await assert.rejects(() => db.exec(sql), pattern);
}
try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb not null default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to anon,authenticated,service_role;grant execute on function auth.uid() to anon,authenticated,service_role;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets,name text,owner_id text);
 alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated,service_role;grant select,insert on storage.objects to anon,authenticated;grant all on storage.objects to service_role;
 create function storage.foldername(name text) returns text[] language sql immutable as $$select string_to_array(name,'/')$$;`);
  const migrations = (await readdir("supabase/migrations"))
    .filter((x) => x.endsWith(".sql"))
    .sort();
  for (const migration of migrations)
    await db.exec(await readFile("supabase/migrations/" + migration, "utf8"));
  console.log(
    "Applied " +
      migrations.length +
      " migrations to actual embedded PostgreSQL. Auth and Storage fixture schemas replace external services.",
  );
  await db.exec(await readFile("supabase/seed.sql", "utf8"));
  await test("All exposed tables have RLS", async () =>
    assert.equal(
      (
        await q(
          "select count(*)::int n from pg_tables where schemaname='public' and not rowsecurity",
        )
      )[0].n,
      0,
    ));
  await db.exec(
    `insert into auth.users values('${uid(1)}','{"display_name":"Passenger One","role":"admin"}'),('${uid(2)}','{"display_name":"Operator One","role":"owner"}'),('${uid(3)}','{"display_name":"Other Passenger"}'),('${uid(4)}','{"display_name":"Administrator"}'),('${uid(5)}','{"display_name":"Operator Two","role":"owner"}');update public.profiles set role='admin' where id='${uid(4)}';`,
  );
  await test("Registration metadata cannot grant admin", async () =>
    assert.equal(
      (await q("select role from profiles where id=$1", [uid(1)]))[0].role,
      "passenger",
    ));
  await as("authenticated", uid(2));
  const boatData = {
    name: "TEST VESSEL",
    description: "SQL integration fixture only",
    boat_type: "motorized_bangka",
    capacity: 4,
    home_location_id: "10000000-0000-4000-8000-000000000001",
    seat_price_minor: 15000,
    charter_price_minor: 150000,
  };
  const boat = (
    await q("select public.save_boat($1) id", [JSON.stringify(boatData)])
  )[0].id;
  await test("Owner cannot self-approve", () =>
    fails(
      `select public.review_boat('${boat}','approved','Self approval')`,
      /Administrator required/,
    ));
  await test("Owner cannot write verification fields directly", () =>
    fails(
      `update boats set verification_status='approved' where id='${boat}'`,
      /permission denied/,
    ));
  await test("Submit requires documents", () =>
    fails(`select public.submit_boat('${boat}')`, /required documents/));
  await db.exec("reset role");
  await db.exec(
    `insert into boat_documents(boat_id,requirement_id,storage_path) select '${boat}',id,'fixture/'||id from document_requirements;`,
  );
  await as("authenticated", uid(2));
  await test("Complete registration submits", async () => {
    await db.exec(`select public.submit_boat('${boat}')`);
  });
  await as("anon");
  await test("Unapproved boat hidden publicly", async () =>
    assert.equal((await q("select * from boats")).length, 0));
  await as("authenticated", uid(4));
  await test("Administrator approval creates audit history", async () => {
    await db.exec(
      `select public.review_boat('${boat}','approved','Documents verified for integration test')`,
    );
    assert.equal(
      (await q("select * from admin_audit_logs where action='boat.approved'"))
        .length,
      1,
    );
  });
  await as("anon");
  await test("Approved boat visible publicly", async () =>
    assert.equal((await q("select * from boats")).length, 1));
  await test("Anonymous cannot read private profiles or payments", async () => {
    await fails("select * from profiles", /permission denied/);
    await fails("select * from payments", /permission denied/);
  });
  await as("authenticated", uid(5));
  await test("Other owner cannot access registration documents", async () =>
    assert.equal((await q("select * from boat_documents")).length, 0));
  await test("Other owner cannot edit boat", () =>
    fails(
      `select public.save_boat('${JSON.stringify(boatData)}','${boat}')`,
      /Not your boat/,
    ));
  await as("authenticated", uid(2));
  const route = (await q("select id from routes limit 1"))[0].id;
  const schedule = {
    boat_id: boat,
    route_id: route,
    starts_at: new Date(Date.now() + 86400000).toISOString(),
    ends_at: new Date(Date.now() + 90000000).toISOString(),
    mode: "seat",
    capacity: 4,
    price_minor: 15000,
  };
  const sid = (
    await q("select public.save_schedule($1) id", [JSON.stringify(schedule)])
  )[0].id;
  await test("Schedule overlap rejected", () =>
    fails(
      `select public.save_schedule('${JSON.stringify(schedule)}')`,
      /overlaps/,
    ));
  await test("Schedule cannot exceed boat capacity", () =>
    fails(
      `select public.save_schedule('${JSON.stringify({ ...schedule, capacity: 5 })}')`,
      /capacity/,
    ));
  await as("authenticated", uid(1));
  await test("Passenger cannot change role", () =>
    fails("update profiles set role='admin'", /permission denied/));
  await test("Passenger sees only own profile", async () =>
    assert.equal((await q("select * from profiles")).length, 1));
  await test("Invalid passenger count rejected", () =>
    fails(
      `select public.reserve_booking('${sid}',5,'${uid(20)}')`,
      /passenger count invalid/,
    ));
  const key = uid(21);
  const booking = (
    await q("select (public.reserve_booking($1,3,$2)).*", [sid, key])
  )[0];
  await test("Per-seat fare and commission snapshot", async () => {
    assert.equal(Number(booking.base_minor), 45000);
    assert.equal(Number(booking.commission_minor), 4500);
    assert.equal(Number(booking.operator_minor), 40500);
  });
  await test("Network retry returns same booking", async () =>
    assert.equal(
      (await q("select (public.reserve_booking($1,3,$2)).id", [sid, key]))[0]
        .id,
      booking.id,
    ));
  await test("Reused idempotency key rejects changed input", () =>
    fails(
      `select public.reserve_booking('${sid}',1,'${key}')`,
      /different request/,
    ));
  await as("authenticated", uid(3));
  await test("Private bookings are hidden from other passenger", async () =>
    assert.equal((await q("select * from bookings")).length, 0));
  await test("Overbooking rejected atomically", () =>
    fails(
      `select public.reserve_booking('${sid}',2,'${uid(22)}')`,
      /Insufficient/,
    ));
  await as("authenticated", uid(2));
  await db.exec(`select public.booking_action('${booking.id}','accept')`);
  await as("authenticated", uid(1));
  await test("Passenger cannot mark payment verified", () =>
    fails(
      `select public.verify_payment('evt_fake','cs_fake','pay_fake',45000,'PHP')`,
      /permission denied/,
    ));
  await as("service_role");
  const payment = (
    await q("select (public.prepare_checkout($1,$2)).*", [uid(1), booking.id])
  )[0];
  await test("Duplicate checkout gets one durable payment", async () =>
    assert.equal(
      (
        await q("select (public.prepare_checkout($1,$2)).id", [
          uid(1),
          booking.id,
        ])
      )[0].id,
      payment.id,
    ));
  await test("Checkout claim is single use", async () => {
    assert.equal(
      (await q("select public.claim_checkout($1) ok", [payment.id]))[0].ok,
      true,
    );
    assert.equal(
      (await q("select public.claim_checkout($1) ok", [payment.id]))[0].ok,
      false,
    );
  });
  await q(
    "update payments set provider_checkout_id='cs_test',checkout_url='https://checkout.paymongo.com/test' where id=$1",
    [payment.id],
  );
  await test("Wrong payment amount rejected", () =>
    fails(
      "select public.verify_payment('evt_wrong','cs_test','pay_test',1,'PHP')",
      /mismatch/,
    ));
  await test("Wrong payment currency rejected", () =>
    fails(
      "select public.verify_payment('evt_wrong','cs_test','pay_test',45000,'USD')",
      /mismatch/,
    ));
  await test("Verified payment confirms booking", async () =>
    assert.equal(
      (
        await q(
          "select public.verify_payment('evt_success','cs_test','pay_test',45000,'PHP') status",
        )
      )[0].status,
      "confirmed",
    ));
  await test("Duplicate webhook cannot duplicate commission", async () => {
    assert.equal(
      (
        await q(
          "select public.verify_payment('evt_success','cs_test','pay_test',45000,'PHP') status",
        )
      )[0].status,
      "duplicate",
    );
    assert.equal((await q("select * from platform_commissions")).length, 1);
  });
  await as("authenticated", uid(1));
  await test("Passenger cannot alter financial records", () =>
    fails("update payments set status='paid'", /permission denied/));
  await as("authenticated", uid(2));
  await test("Trip cannot be completed before arrival", () =>
    fails(
      `select public.booking_action('${booking.id}','complete')`,
      /cannot be completed/,
    ));
  await as("authenticated", uid(1));
  await test("Paid cancellation creates refund request", async () => {
    await db.exec(
      `select public.booking_action('${booking.id}','cancel','Passenger requested a cancellation')`,
    );
    assert.equal((await q("select * from refunds")).length, 1);
  });
  await as("service_role");
  const refund = (await q("select * from refunds"))[0];
  await q("update refunds set provider_reference='ref_test' where id=$1", [
    refund.id,
  ]);
  await test("Refund confirmation reverses ledger", async () => {
    await q("select public.confirm_refund($1,$2,$3)", [
      refund.id,
      "ref_test",
      45000,
    ]);
    assert.equal(
      (await q("select status from bookings where id=$1", [booking.id]))[0]
        .status,
      "refunded",
    );
    assert.equal(
      (await q("select reconciliation_status from platform_commissions"))[0]
        .reconciliation_status,
      "reversed",
    );
  });
  await test("Paid event replay cannot revive a refunded booking", async () => {
    assert.equal(
      (
        await q(
          "select public.verify_payment('evt_after_refund','cs_test','pay_test',45000,'PHP') status",
        )
      )[0].status,
      "duplicate",
    );
    assert.equal(
      (await q("select status from bookings where id=$1", [booking.id]))[0]
        .status,
      "refunded",
    );
  });
  // A second paid trip proves actual owner completion -> payable -> audited settlement.
  await as("authenticated", uid(1));
  const settledBooking = (
    await q("select (public.reserve_booking($1,1,$2)).*", [sid, uid(30)])
  )[0];
  await as("authenticated", uid(2));
  await q("select public.booking_action($1,$2)", [settledBooking.id, "accept"]);
  await as("service_role");
  const settledPayment = (
    await q("select (public.prepare_checkout($1,$2)).*", [
      uid(1),
      settledBooking.id,
    ])
  )[0];
  await q("update payments set provider_checkout_id='cs_settle' where id=$1", [
    settledPayment.id,
  ]);
  await q(
    "select public.verify_payment('evt_settle','cs_settle','pay_settle',15000,'PHP')",
  );
  await test("Verified provider fee is retained and cannot be changed", async () => {
    await q("select public.record_provider_fee($1,300)", [settledPayment.id]);
    await assert.rejects(
      () => q("select public.record_provider_fee($1,301)", [settledPayment.id]),
      /fee changed/,
    );
  });
  await db.exec("reset role");
  await q(
    "update boat_schedules set starts_at=now()-interval '2 hours',ends_at=now()-interval '1 hour' where id=$1",
    [sid],
  );
  await as("authenticated", uid(2));
  await q("select public.booking_action($1,$2)", [
    settledBooking.id,
    "complete",
  ]);
  await test("Completed verified trip creates reconciled owner payable", async () =>
    assert.equal(
      Number(
        (
          await q("select amount_minor from payouts where booking_id=$1", [
            settledBooking.id,
          ])
        )[0].amount_minor,
      ),
      13200,
    ));
  await as("service_role");
  await q("select public.record_provider_fee($1,300)", [settledPayment.id]);
  await test("Provider fee reconciles pending payout to actual net amount", async () =>
    assert.equal(
      Number(
        (
          await q("select amount_minor from payouts where booking_id=$1", [
            settledBooking.id,
          ])
        )[0].amount_minor,
      ),
      13200,
    ));
  await as("authenticated", uid(2));
  await test("Owner cannot settle own payout", () =>
    fails("update payouts set status='settled'", /permission denied/));
  const payout = (
    await q("select id from payouts where booking_id=$1", [settledBooking.id])
  )[0].id;
  await as("authenticated", uid(4));
  await test("Authorized reconciliation records bank reference and audit", async () => {
    await q("select public.admin_action($1,$2,$3)", [
      "payout_settle",
      payout,
      JSON.stringify({
        bank_reference: "TEST-BANK-REF-001",
        reason: "TEST verified bank settlement",
      }),
    ]);
    assert.equal(
      (await q("select status from payouts where id=$1", [payout]))[0].status,
      "settled",
    );
    assert.equal(
      (await q("select * from admin_audit_logs where action='payout_settle'"))
        .length,
      1,
    );
  });
  await test("Duplicate settlement does not silently report a new payout", () =>
    fails(
      `select public.admin_action('payout_settle','${payout}','{"bank_reference":"TEST-BANK-REF-002","reason":"Duplicate settlement attempt"}')`,
      /already been settled/,
    ));
  await test("Configuration requires administrator", async () => {
    await as("authenticated", uid(1));
    await fails(
      'select public.configure_platform(\'setting\',\'{"key":"platform_name","value":"Injected","reason":"Test denied change"}\')',
      /Administrator required/,
    );
  });
  await as("authenticated", uid(4));
  await test("Administrator configuration is persisted and audited", async () => {
    await q("select public.configure_platform($1,$2)", [
      "setting",
      JSON.stringify({
        key: "privacy_contact",
        value: "TEST privacy contact pending",
        reason: "Test configuration",
      }),
    ]);
    assert.equal(
      (await q("select value from app_settings where key='privacy_contact'"))[0]
        .value,
      "TEST privacy contact pending",
    );
  });
  await as("authenticated", uid(2));
  const charterId = (
    await q("select public.save_schedule($1) id", [
      JSON.stringify({
        ...schedule,
        mode: "charter",
        starts_at: new Date(Date.now() + 2 * 86400000).toISOString(),
        ends_at: new Date(Date.now() + 2 * 86400000 + 3600000).toISOString(),
        price_minor: 150000,
      }),
    ])
  )[0].id;
  await as("authenticated", uid(1));
  const charter = (
    await q("select (public.reserve_booking($1,1,$2)).*", [charterId, uid(23)])
  )[0];
  await test("Charter bills whole boat", async () =>
    assert.equal(Number(charter.base_minor), 150000));
  await as("authenticated", uid(3));
  await test("Charter excludes all other reservations", () =>
    fails(
      `select public.reserve_booking('${charterId}',1,'${uid(24)}')`,
      /Insufficient/,
    ));
  await db.exec("reset role");
  await q(
    "update bookings set reservation_expires_at=now()-interval '1 minute' where id=$1",
    [charter.id],
  );
  await as("authenticated", uid(3));
  await test("Expired reservation releases capacity", async () =>
    assert.notEqual(
      (
        await q("select (public.reserve_booking($1,1,$2)).id", [
          charterId,
          uid(25),
        ])
      )[0].id,
      charter.id,
    ));
  await as("service_role");
  await q(
    "insert into payments(booking_id,provider_checkout_id,amount_minor) values($1,'cs_late',150000)",
    [charter.id],
  );
  await test("Late payment routes to refund instead of overbooking", async () =>
    assert.equal(
      (
        await q(
          "select public.verify_payment('evt_late','cs_late','pay_late',150000,'PHP') status",
        )
      )[0].status,
      "refund_pending",
    ));
  await as("authenticated", uid(4));
  await test("Commission configuration does not rewrite history", async () => {
    await q("select public.admin_action($1,null,$2)", [
      "commission",
      JSON.stringify({
        rate_bps: 2000,
        service_fee_minor: 100,
        effective_at: new Date().toISOString(),
        reason: "New testing configuration",
      }),
    ]);
    assert.equal(
      (await q("select rate_bps from bookings where id=$1", [booking.id]))[0]
        .rate_bps,
      1000,
    );
  });
  await test("Future fee activation is exposed as a refresh boundary without changing the current fare", async () => {
    const effective = new Date(Date.now() + 60000).toISOString();
    await q("select public.admin_action($1,null,$2)", [
      "commission",
      JSON.stringify({
        rate_bps: 3000,
        service_fee_minor: 500,
        effective_at: effective,
        reason: "TEST future fee activation",
      }),
    ]);
    const quote = (
      await q("select public.quote_booking($1,1) value", [charterId])
    )[0].value;
    assert.equal(quote.service_fee_minor, 100);
    assert.equal(Date.parse(quote.next_change_at), Date.parse(effective));
    const available = (
      await q("select * from public.available_schedules()")
    ).find((s) => s.id === charterId);
    assert.equal(
      new Date(available.next_change_at).getTime(),
      Date.parse(effective),
    );
  });
  await test("Suspension hides boat from public search", async () => {
    await db.exec(
      `select public.admin_action('account_status','${uid(2)}','{"status":"suspended","reason":"Safety investigation"}')`,
    );
    await as("anon");
    assert.equal((await q("select * from boats")).length, 0);
    assert.equal(
      (await q("select * from public.available_schedules()")).length,
      0,
    );
  });
  await db.exec("reset role");
  await test("Realtime publishes only sanitized signals, never private records or delete keys", async () => {
    const tables = await q(
      "select tablename from pg_publication_tables where pubname='supabase_realtime' and schemaname='public'",
    );
    assert.deepEqual(
      tables.map((t) => t.tablename),
      ["live_events"],
    );
  });
  await test("Every application data table emits a live invalidation", async () => {
    const rows = await q(
      "select count(distinct c.relname)::int n from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and t.tgname in ('signal_catalog','signal_access','signal_account','signal_commission','signal_settings') and t.tgenabled<>'D'",
    );
    assert.equal(rows[0].n, 21);
  });
  await test("Live signals contain no private identifiers, amounts or document data", async () => {
    const rows = await q("select * from live_events limit 1");
    assert.equal(rows.length, 1);
    assert.deepEqual(Object.keys(rows[0]).sort(), [
      "created_at",
      "id",
      "scope",
    ]);
  });
  await test("Unauthenticated clients receive catalog invalidation but not account activity", async () => {
    await as("anon");
    assert.ok(
      (await q("select * from live_events where scope in ('catalog','access')"))
        .length > 0,
    );
    assert.equal(
      (await q("select * from live_events where scope='account'")).length,
      0,
    );
  });
  await test("Anonymous readiness check exposes only database capability, not private data", async () => {
    const health = (await q("select public.realtime_health() state"))[0].state;
    assert.deepEqual(Object.keys(health), ["ready"]);
    assert.equal(
      health.ready,
      (await q("select current_setting('wal_level') level"))[0].level ===
        "logical",
    );
  });
  await test("Active authenticated clients can receive non-identifying account signals", async () => {
    await as("authenticated", uid(1));
    assert.ok(
      (await q("select * from live_events where scope='account'")).length > 0,
    );
  });
  await test("Clients cannot forge live updates", () =>
    fails(
      "insert into live_events(scope) values('catalog')",
      /permission denied/,
    ));
  await test("Zero-row writes do not create false update signals", async () => {
    const before = (await q("select count(*)::int n from live_events"))[0].n;
    await q(
      "update profiles set display_name='No matching profile' where id=$1",
      [uid(999)],
    );
    assert.equal(
      (await q("select count(*)::int n from live_events"))[0].n,
      before,
    );
  });
  await test("A transaction emits only one signal per scope", async () => {
    await db.exec("reset role");
    const before = (
      await q("select count(*)::int n from live_events where scope='settings'")
    )[0].n;
    await db.exec(
      "begin;insert into app_settings(key,value) values('TEST-a','true'),('TEST-b','true');update app_settings set value='false' where key='TEST-a';commit",
    );
    assert.equal(
      (
        await q(
          "select count(*)::int n from live_events where scope='settings'",
        )
      )[0].n,
      before + 1,
    );
  });
  await test("Suspended accounts cannot receive account activity signals", async () => {
    await as("authenticated", uid(2));
    assert.equal(
      (await q("select * from live_events where scope='account'")).length,
      0,
    );
  });
  await test("Live events older than the visibility window are not exposed", async () => {
    await db.exec("reset role");
    await q(
      "insert into live_events(scope,created_at) values('catalog',now()-interval '2 days')",
    );
    await as("anon");
    assert.equal(
      (
        await q(
          "select * from live_events where created_at<now()-interval '1 day'",
        )
      ).length,
      0,
    );
  });
  await test("Only the maintenance worker can prune old live signals", async () => {
    await fails("select public.prune_live_events()", /permission denied/);
    await as("service_role");
    assert.equal(
      Number((await q("select public.prune_live_events() n"))[0].n),
      1,
    );
  });
  await test("Google OAuth full_name metadata populates profile display_name and passenger can self-activate owner role", async () => {
    await db.exec("reset role");
    await db.exec(
      `insert into auth.users values('${uid(60)}','{"full_name":"Juan Dela Cruz","provider":"google"}');`,
    );
    const created = (
      await q("select display_name, role from profiles where id=$1", [uid(60)])
    )[0];
    assert.equal(created.display_name, "Juan Dela Cruz");
    assert.equal(created.role, "passenger");
    await as("authenticated", uid(60));
    await q("select public.register_as_owner()");
    const upgraded = (
      await q("select role from profiles where id=$1", [uid(60)])
    )[0];
    assert.equal(upgraded.role, "owner");
    const ownerRow = await q("select * from boat_owners where id=$1", [
      uid(60),
    ]);
    assert.equal(ownerRow.length, 1);
  });
  console.log(
    `\n${passed} database checks passed. This is PostgreSQL engine validation, not hosted Supabase/Auth/Storage or multi-connection stress testing.`,
  );
} finally {
  await db.close();
}
