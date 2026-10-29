import React, { useState } from "react";
import { BookingContact } from "../../src/BookingContact";
import { Text, View, Pressable } from "react-native";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as DocumentPicker from "expo-document-picker";
import * as Crypto from "expo-crypto";
import {
  bookingViewStatus,
  boatSchema,
  scheduleSchema,
  php,
  tripDate,
} from "@bangkago/shared";
import { backend, supabase } from "../../src/client";
import { useSession } from "../../src/session";
import { Screen, Button, Field, Badge, State, styles, c } from "../../src/ui";
import {
  GisRouteCard,
  KNOWN_PORTS,
  openGisNavigation,
  resolvePortGis,
} from "../../src/GisMap";

export default function Owner() {
  const { session, profile, loading, error } = useSession();
  const [tab, setTab] = useState("boats");
  const [reqSearch, setReqSearch] = useState("");
  const [reqFilter, setReqFilter] = useState("all");
  const [showFinanceSummary, setShowFinanceSummary] = useState(false);
  const [message, setMessage] = useState("");
  const qc = useQueryClient();
  const data = useQuery({
    queryKey: ["owner", profile?.id],
    enabled: profile?.role === "owner" || profile?.role === "admin",
    queryFn: async () => {
      const [
        boats,
        bookings,
        payouts,
        fees,
        locations,
        routes,
        requirements,
        schedules,
        refunds,
      ] = await Promise.all(
        [
          "boats",
          "bookings",
          "payouts",
          "platform_commissions",
          "locations",
          "routes",
          "document_requirements",
          "boat_schedules",
          "refunds",
        ].map((t) => backend.rows(t)),
      );
      return {
        boats: boats.filter(
          (b) => b.owner_id === profile!.id || profile?.role === "admin",
        ),
        bookings: bookings.filter(
          (b) =>
            profile?.role === "admin" ||
            boats.some((t) => t.owner_id === profile!.id && t.id === b.boat_id),
        ),
        payouts,
        fees,
        locations,
        routes,
        requirements,
        schedules,
        refunds,
      };
    },
  });
  const mutation = useMutation({
    mutationFn: async ({ action, id }: { action: string; id: string }) => {
      if (action === "register_owner")
        return backend.rpc("register_as_owner");
      if (action === "submit") return backend.rpc("submit_boat", { p_id: id });
      if (action === "toggle")
        return backend.rpc("set_boat_active", { p_id: id });
      if (action === "close")
        return backend.rpc("close_schedule", { p_id: id });
      return backend.rpc("booking_action", {
        p_id: id,
        p_action: action,
        p_reason: "Operator decision via booking management",
      });
    },
    onSuccess: () => {
      setMessage("Saved.");
      qc.invalidateQueries();
    },
    onError: (e) => setMessage(e.message),
  });
  if (loading)
    return (
      <Screen>
        <State loading />
      </Screen>
    );
  if (error)
    return (
      <Screen>
        <State error={error} />
      </Screen>
    );
  if (profile?.role !== "owner" && profile?.role !== "admin")
    return (
      <Screen>
        <Text style={styles.title}>Boat operator workspace</Text>
        <Text style={styles.subtitle}>
          Sign in with a registered boat owner account.
        </Text>
        {!session ? (
          <Button title="Sign in" onPress={() => router.push("/auth")} />
        ) : (
          <View style={styles.card}>
            <Text style={styles.h2}>Activate operator account</Text>
            <Text style={styles.muted}>
              Signed in as {profile?.display_name ?? session.user.email}. Enable
              your boat operator workspace to register vessels, upload permits,
              set GIS boarding points, and manage passenger bookings.
            </Text>
            <Button
              title="Become a boat operator"
              busy={mutation.isPending}
              onPress={() =>
                mutation.mutate({ action: "register_owner", id: "" })
              }
            />
          </View>
        )}
        {!!message && (
          <Text style={styles.subtitle} accessibilityLiveRegion="polite">
            {message}
          </Text>
        )}
      </Screen>
    );
  const d = data.data;
  const sum = (rows: any[] | undefined, key: string) =>
    (rows ?? []).reduce((n, r) => n + Number(r[key]), 0);
  return (
    <Screen>
      <Text style={styles.title}>Welcome, captain.</Text>
      <Text style={styles.subtitle}>
        Your registered boats, GIS boarding points, and passenger manifest.
      </Text>
      {data.isPending ? (
        <State loading />
      ) : data.error ? (
        <State error={data.error} retry={() => data.refetch()} />
      ) : (
        d && (
          <>
            <View style={styles.card}>
              <View style={styles.between}>
                <Text style={styles.h2}>{d.boats.length} registered boats</Text>
                <Badge
                  value={`${d.bookings.filter((b) => bookingViewStatus(b) === "pending_owner_confirmation").length} requests`}
                />
              </View>
              <View style={styles.row}>
                {[
                  [
                    "Confirmed trips",
                    String(
                      d.bookings.filter(
                        (b) => bookingViewStatus(b) === "confirmed",
                      ).length,
                    ),
                  ],
                  [
                    "Completed trips",
                    String(
                      d.bookings.filter(
                        (b) => bookingViewStatus(b) === "completed",
                      ).length,
                    ),
                  ],
                  [
                    "Settled payouts",
                    php(
                      sum(
                        d.payouts.filter((p) => p.status === "settled"),
                        "amount_minor",
                      ),
                    ),
                  ],
                  [
                    "Pending payouts",
                    php(
                      sum(
                        d.payouts.filter((p) => p.status === "pending"),
                        "amount_minor",
                      ),
                    ),
                  ],
                ].map(([label, val]) => (
                  <View
                    key={label}
                    style={{
                      flex: 1,
                      minWidth: 135,
                      backgroundColor: "#F8FAFC",
                      borderColor: c.border,
                      borderWidth: 1,
                      borderRadius: 12,
                      padding: 12,
                      gap: 3,
                    }}
                  >
                    <Text style={styles.muted}>{label}</Text>
                    <Text
                      style={{
                        fontSize: 17,
                        fontWeight: "800",
                        color: c.navy,
                      }}
                    >
                      {val}
                    </Text>
                  </View>
                ))}
              </View>
              <Pressable
                onPress={() => setShowFinanceSummary((v) => !v)}
                style={{ paddingVertical: 4 }}
              >
                <Text style={styles.link}>
                  {showFinanceSummary
                    ? "Hide ledger breakdown ▲"
                    : "Show ledger & commission breakdown ▼"}
                </Text>
              </Pressable>
              {showFinanceSummary && (
                <>
                  <View style={styles.hr} />
                  <View style={styles.between}>
                    <Text style={styles.muted}>Estimated gross requests</Text>
                    <Text style={styles.subtitle}>
                      {php(sum(d.bookings, "base_minor"))}
                    </Text>
                  </View>
                  <View style={styles.between}>
                    <Text style={styles.muted}>
                      Verified fare commission deductions
                    </Text>
                    <Text style={styles.subtitle}>
                      {php(
                        sum(
                          d.fees.filter(
                            (f) => f.reconciliation_status !== "reversed",
                          ),
                          "commission_minor",
                        ),
                      )}
                    </Text>
                  </View>
                  <View style={styles.between}>
                    <Text style={styles.muted}>
                      Verified operator payable (pre-fee)
                    </Text>
                    <Text style={styles.subtitle}>
                      {php(
                        sum(
                          d.fees.filter(
                            (f) => f.reconciliation_status !== "reversed",
                          ),
                          "operator_minor",
                        ),
                      )}
                    </Text>
                  </View>
                  <View style={styles.between}>
                    <Text style={styles.muted}>Refunds confirmed</Text>
                    <Text style={styles.subtitle}>
                      {php(
                        sum(
                          d.refunds.filter((r) => r.status === "confirmed"),
                          "amount_minor",
                        ),
                      )}
                    </Text>
                  </View>
                </>
              )}
            </View>
            <View style={styles.row}>
              {["boats", "requests", "schedules", "earnings"].map((t) => (
                <Pressable
                  key={t}
                  style={[styles.pill, tab === t && styles.pillSelected]}
                  onPress={() => setTab(t)}
                >
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: "700",
                      color: tab === t ? c.ocean : c.navy,
                    }}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
            {tab === "boats" ? (
              <>
                <BoatForm locations={d.locations} notify={setMessage} />
                {d.boats.map((b) => {
                  const homeLoc = d.locations.find(
                    (l: any) => l.id === b.home_location_id,
                  );
                  const portGis = resolvePortGis(
                    homeLoc?.name,
                    b.pickup_lat ?? homeLoc?.latitude,
                    b.pickup_lng ?? homeLoc?.longitude,
                    b.pickup_label || homeLoc?.landmark,
                  );
                  return (
                    <View key={b.id} style={styles.card}>
                      <View style={styles.between}>
                        <Text style={styles.h2}>{b.name}</Text>
                        <Badge value={b.verification_status} />
                      </View>
                      <Text style={styles.muted}>
                        {b.capacity} passengers ·{" "}
                        {b.active ? "Operating" : "Inactive"}
                      </Text>
                      <Text style={styles.muted}>
                        Charter {php(b.charter_price_minor)} · seat{" "}
                        {php(b.seat_price_minor)}
                      </Text>
                      <View
                        style={{
                          backgroundColor: "#F0FDF4",
                          borderRadius: 10,
                          paddingHorizontal: 11,
                          paddingVertical: 8,
                          borderWidth: 1,
                          borderColor: "#BBF7D0",
                          flexDirection: "row",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "700",
                              color: "#14532D",
                            }}
                          >
                            📍 Default GIS Boarding Point: {portGis.landmark}
                          </Text>
                          <Text style={{ fontSize: 11, color: "#166534" }}>
                            GPS {portGis.lat.toFixed(4)}°N,{" "}
                            {portGis.lng.toFixed(4)}°E
                          </Text>
                        </View>
                        <Pressable
                          onPress={() =>
                            openGisNavigation(
                              portGis.lat,
                              portGis.lng,
                              portGis.landmark,
                            )
                          }
                          style={{
                            backgroundColor: "#FFFFFF",
                            paddingHorizontal: 9,
                            paddingVertical: 5,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: "#86EFAC",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: "800",
                              color: c.success,
                            }}
                          >
                            Map →
                          </Text>
                        </Pressable>
                      </View>
                      {["draft", "needs_correction", "rejected"].includes(
                        b.verification_status,
                      ) && (
                        <>
                          <AttachmentForm
                            boat={b}
                            requirements={d.requirements}
                            notify={setMessage}
                          />
                          <Button
                            title="Submit for review"
                            busy={mutation.isPending}
                            onPress={() =>
                              mutation.mutate({ action: "submit", id: b.id })
                            }
                          />
                          <BoatForm
                            locations={d.locations}
                            notify={setMessage}
                            existing={b}
                          />
                        </>
                      )}
                      {b.verification_status === "approved" && (
                        <Button
                          secondary
                          title={
                            b.active ? "Pause new bookings" : "Resume bookings"
                          }
                          busy={mutation.isPending}
                          onPress={() =>
                            mutation.mutate({ action: "toggle", id: b.id })
                          }
                        />
                      )}
                    </View>
                  );
                })}
              </>
            ) : tab === "requests" ? (
              <>
                <View style={styles.card}>
                  <Text style={styles.h2}>Passenger manifest & GIS check-in</Text>
                  <Field
                    label="Search booking reference (e.g. BG-...)"
                    placeholder="Type passenger reference"
                    value={reqSearch}
                    onChangeText={setReqSearch}
                  />
                  <View style={styles.row}>
                    {[
                      ["all", "All"],
                      ["pending", "Pending"],
                      ["confirmed", "Confirmed"],
                      ["completed", "Completed"],
                    ].map(([val, label]) => (
                      <Pressable
                        key={val}
                        style={[
                          styles.pill,
                          reqFilter === val && styles.pillSelected,
                        ]}
                        onPress={() => setReqFilter(val)}
                      >
                        <Text style={styles.link}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
                {d.bookings
                  .filter((b) => {
                    const st = bookingViewStatus(b);
                    const matchesRef =
                      !reqSearch ||
                      String(b.reference ?? "")
                        .toLowerCase()
                        .includes(reqSearch.trim().toLowerCase());
                    const matchesStatus =
                      reqFilter === "all" ||
                      (reqFilter === "pending" &&
                        ["pending_owner_confirmation", "awaiting_payment"].includes(
                          st,
                        )) ||
                      st === reqFilter;
                    return matchesRef && matchesStatus;
                  })
                  .map((b) => {
                    const sched = d.schedules.find(
                      (s: any) => s.id === b.schedule_id,
                    );
                    const boatObj = d.boats.find(
                      (x: any) => x.id === b.boat_id,
                    );
                    const routeObj = d.routes.find(
                      (r: any) => r.id === sched?.route_id,
                    );
                    const originLoc = d.locations.find(
                      (l: any) => l.id === routeObj?.origin_id,
                    );
                    const destLoc = d.locations.find(
                      (l: any) => l.id === routeObj?.destination_id,
                    );
                    return (
                      <View key={b.id} style={styles.card}>
                        <View style={styles.between}>
                          <Text style={styles.h2}>{b.reference}</Text>
                          <Badge value={bookingViewStatus(b)} />
                        </View>
                        <View style={styles.between}>
                          <Text style={styles.subtitle}>
                            {boatObj?.name} · {b.passenger_count} pax
                          </Text>
                          <Text style={styles.price}>{php(b.total_minor)}</Text>
                        </View>
                        <Text style={styles.muted}>
                          {sched
                            ? tripDate(sched.starts_at)
                            : "Schedule unavailable"}
                        </Text>
                        {!!b.instructions && (
                          <Text style={styles.muted}>
                            Passenger notes: {b.instructions}
                          </Text>
                        )}
                        <PickupReminderForm
                          booking={b}
                          originName={originLoc?.name ?? "Abra de Ilog Port"}
                          destinationName={destLoc?.name ?? "Wawa"}
                          defaultPickupLabel={
                            b.pickup_label ||
                            sched?.pickup_label ||
                            boatObj?.pickup_label ||
                            originLoc?.landmark ||
                            "Pier 1 Boarding Ramp"
                          }
                          defaultLat={
                            b.pickup_lat ??
                            sched?.pickup_lat ??
                            boatObj?.pickup_lat ??
                            originLoc?.latitude
                          }
                          defaultLng={
                            b.pickup_lng ??
                            sched?.pickup_lng ??
                            boatObj?.pickup_lng ??
                            originLoc?.longitude
                          }
                          notify={setMessage}
                        />
                        {bookingViewStatus(b) ===
                          "pending_owner_confirmation" && (
                          <View style={styles.row}>
                            <Button
                              title="Accept request"
                              busy={mutation.isPending}
                              onPress={() =>
                                mutation.mutate({ action: "accept", id: b.id })
                              }
                            />
                            <Button
                              secondary
                              title="Reject request"
                              busy={mutation.isPending}
                              onPress={() =>
                                mutation.mutate({ action: "reject", id: b.id })
                              }
                            />
                          </View>
                        )}
                        {bookingViewStatus(b) === "confirmed" && (
                          <Button
                            secondary
                            title="Mark trip completed"
                            busy={mutation.isPending}
                            onPress={() =>
                              mutation.mutate({ action: "complete", id: b.id })
                            }
                          />
                        )}
                        {[
                          "awaiting_payment",
                          "confirmed",
                          "completed",
                        ].includes(bookingViewStatus(b)) && (
                          <BookingContact id={b.id} />
                        )}
                        <Button
                          secondary
                          title="Contact / booking support"
                          onPress={() => router.push("/support")}
                        />
                      </View>
                    );
                  })}
                {!d.bookings.length && (
                  <State empty="No booking requests yet." />
                )}
              </>
            ) : tab === "schedules" ? (
              <>
                <ScheduleForm
                  boats={d.boats.filter(
                    (b) => b.verification_status === "approved" && b.active,
                  )}
                  routes={d.routes}
                  locations={d.locations}
                  notify={setMessage}
                />
                {d.schedules
                  .filter((s) => d.boats.some((b) => b.id === s.boat_id))
                  .map((s) => {
                    const booked = d.bookings
                      .filter(
                        (b) =>
                          b.schedule_id === s.id &&
                          [
                            "pending_owner_confirmation",
                            "awaiting_payment",
                            "confirmed",
                            "completed",
                          ].includes(bookingViewStatus(b)),
                      )
                      .reduce(
                        (acc, b) =>
                          acc +
                          (b.mode === "charter"
                            ? Number(s.capacity)
                            : Number(b.passenger_count)),
                        0,
                      );
                    const pct = Math.min(
                      100,
                      Math.round(
                        (booked / Math.max(1, Number(s.capacity))) * 100,
                      ),
                    );
                    return (
                      <View style={styles.card} key={s.id}>
                        <View style={styles.between}>
                          <Text style={styles.h2}>
                            {d.boats.find((b) => b.id === s.boat_id)?.name}
                          </Text>
                          <Badge value={s.status} />
                        </View>
                        <Text style={styles.subtitle}>
                          {tripDate(s.starts_at)}
                        </Text>
                        <Text style={styles.muted}>
                          {s.mode} · capacity {s.capacity} · {php(s.price_minor)}
                        </Text>
                        {!!s.pickup_label && (
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "700",
                              color: c.success,
                            }}
                          >
                            📍 Boarding point: {s.pickup_label}
                          </Text>
                        )}
                        <View style={{ gap: 5 }}>
                          <View style={styles.between}>
                            <Text style={styles.muted}>Seat occupancy</Text>
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: "700",
                                color: c.navy,
                              }}
                            >
                              {booked} / {s.capacity} ({pct}%)
                            </Text>
                          </View>
                          <View
                            style={{
                              height: 7,
                              borderRadius: 4,
                              backgroundColor: c.border,
                              overflow: "hidden",
                            }}
                          >
                            <View
                              style={{
                                height: "100%",
                                width: `${pct}%`,
                                backgroundColor: c.ocean,
                              }}
                            />
                          </View>
                        </View>
                        {s.status === "open" && (
                          <Button
                            secondary
                            title="Close to new requests"
                            busy={mutation.isPending}
                            onPress={() =>
                              mutation.mutate({ action: "close", id: s.id })
                            }
                          />
                        )}
                      </View>
                    );
                  })}
              </>
            ) : (
              <>
                {d.payouts.length ? (
                  d.payouts.map((p) => (
                    <View key={p.id} style={styles.card}>
                      <Text style={styles.price}>{php(p.amount_minor)}</Text>
                      <Badge value={p.status} />
                      <Text style={styles.muted}>
                        {p.bank_reference ?? "Awaiting verified settlement"}
                      </Text>
                      <Text style={styles.muted}>
                        Booking{" "}
                        {
                          d.bookings.find((b) => b.id === p.booking_id)
                            ?.reference
                        }
                      </Text>
                    </View>
                  ))
                ) : (
                  <State empty="Payouts are created for completed, paid trips." />
                )}
              </>
            )}
          </>
        )
      )}
      {!!message && (
        <Text style={styles.subtitle} accessibilityLiveRegion="polite">
          {message}
        </Text>
      )}
    </Screen>
  );
}

function PickupReminderForm({
  booking,
  originName,
  destinationName,
  defaultPickupLabel,
  defaultLat,
  defaultLng,
  notify,
}: {
  booking: any;
  originName: string;
  destinationName: string;
  defaultPickupLabel: string;
  defaultLat?: number | null;
  defaultLng?: number | null;
  notify: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const resolved = resolvePortGis(
    originName,
    defaultLat,
    defaultLng,
    defaultPickupLabel,
  );
  const [pickupLabel, setPickupLabel] = useState(resolved.landmark);
  const [lat, setLat] = useState(resolved.lat);
  const [lng, setLng] = useState(resolved.lng);
  const [reminder, setReminder] = useState(
    booking.pickup_reminder ||
      "Please proceed to the boarding bay 20 minutes before departure and look for our crew.",
  );
  const qc = useQueryClient();
  const sendMutation = useMutation({
    mutationFn: () =>
      backend.rpc("send_pickup_reminder", {
        p_booking: booking.id,
        p_pickup_label: pickupLabel,
        p_lat: lat,
        p_lng: lng,
        p_reminder: reminder,
      }),
    onSuccess: () => {
      qc.invalidateQueries();
      setOpen(false);
      notify(
        `GIS pickup location & reminder sent to passenger (${booking.reference}).`,
      );
    },
    onError: (e) => notify(e.message),
  });

  return (
    <View style={{ gap: 8 }}>
      <GisRouteCard
        originName={originName}
        destinationName={destinationName}
        pickupLabel={booking.pickup_label || pickupLabel}
        pickupLat={booking.pickup_lat ?? lat}
        pickupLng={booking.pickup_lng ?? lng}
        reminderNote={booking.pickup_reminder}
        reminderSentAt={booking.reminder_sent_at}
        compact
      />
      {[
        "pending_owner_confirmation",
        "awaiting_payment",
        "confirmed",
      ].includes(bookingViewStatus(booking)) && (
        <>
          <Pressable
            onPress={() => setOpen((v) => !v)}
            style={{
              backgroundColor: "#EFF6FF",
              borderColor: "#BFDBFE",
              borderWidth: 1,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 9,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "800", color: c.ocean }}>
              📍{" "}
              {open
                ? "Close GIS Pickup Reminder"
                : "Set GIS Pickup Point & Remind Passenger"}
            </Text>
            <Text style={{ fontSize: 12, fontWeight: "800", color: c.ocean }}>
              {open ? "▲" : "▼"}
            </Text>
          </Pressable>
          {open && (
            <View
              style={{
                backgroundColor: "#F8FAFC",
                borderColor: c.border,
                borderWidth: 1,
                borderRadius: 12,
                padding: 12,
                gap: 10,
              }}
            >
              <Text style={styles.label}>Select Port GIS Pin</Text>
              <View style={styles.row}>
                {Object.entries(KNOWN_PORTS).map(([name, info]) => (
                  <Pressable
                    key={name}
                    style={[
                      styles.pill,
                      Math.abs(lat - info.lat) < 0.005 && styles.pillSelected,
                    ]}
                    onPress={() => {
                      setLat(info.lat);
                      setLng(info.lng);
                      setPickupLabel(info.landmark);
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: "700", color: c.navy }}>
                      {name}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Field
                label="Exact pickup bay / landmark for passenger"
                value={pickupLabel}
                onChangeText={setPickupLabel}
              />
              <Text style={styles.label}>Quick pickup reminder templates</Text>
              <View style={styles.row}>
                {[
                  "Meet at Pier 1 Waiting Shed 20 mins before departure",
                  "Wait by Wawa Coastal Ramp near Coast Guard desk",
                  "Our bangka crew is ready at the boarding dock",
                ].map((tpl) => (
                  <Pressable
                    key={tpl}
                    style={[
                      styles.pill,
                      { paddingVertical: 6, paddingHorizontal: 10 },
                    ]}
                    onPress={() => setReminder(tpl)}
                  >
                    <Text
                      style={{ fontSize: 11, fontWeight: "600", color: c.ocean }}
                    >
                      {tpl}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Field
                label="Passenger pickup reminder message"
                multiline
                value={reminder}
                onChangeText={setReminder}
              />
              <Button
                title="Send GIS Pickup Reminder to Passenger"
                busy={sendMutation.isPending}
                onPress={() => sendMutation.mutate()}
              />
            </View>
          )}
        </>
      )}
    </View>
  );
}

function BoatForm({
  locations,
  notify,
  existing,
}: {
  locations: any[];
  notify: (s: string) => void;
  existing?: any;
}) {
  const [open, setOpen] = useState(false);
  const [pickupLabel, setPickupLabel] = useState(
    existing?.pickup_label ?? "Pier 1 Boarding Ramp, Abra de Ilog Port",
  );
  const qc = useQueryClient();
  const form = useForm({
    resolver: zodResolver(boatSchema),
    defaultValues: {
      name: existing?.name ?? "",
      description: existing?.description ?? "",
      boat_type: existing?.boat_type ?? "motorized_bangka",
      capacity: existing?.capacity ?? 1,
      home_location_id: existing?.home_location_id ?? locations[0]?.id ?? "",
      charter_price: (existing?.charter_price_minor ?? 0) / 100,
      seat_price: (existing?.seat_price_minor ?? 0) / 100,
    },
  });
  const mutation = useMutation({
    mutationFn: async () => {
      if (!(await form.trigger()))
        throw new Error("Please correct the boat details.");
      const v = boatSchema.parse(form.getValues());
      const homeLoc = locations.find((l) => l.id === v.home_location_id);
      const portGis = resolvePortGis(
        homeLoc?.name,
        homeLoc?.latitude,
        homeLoc?.longitude,
        pickupLabel,
      );
      return backend.rpc("save_boat", {
        p_data: {
          ...v,
          charter_price_minor: Math.round(v.charter_price * 100),
          seat_price_minor: Math.round(v.seat_price * 100),
          pickup_label: pickupLabel,
          pickup_lat: portGis.lat,
          pickup_lng: portGis.lng,
        },
        p_id: existing?.id ?? null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries();
      setOpen(false);
      form.reset();
      notify("Draft saved. Upload required documents, then submit for review.");
    },
    onError: (e) => notify(e.message),
  });
  return (
    <View style={styles.card}>
      <Button
        secondary
        title={
          open
            ? "Close form"
            : existing
              ? "Edit registration"
              : "Register a boat"
        }
        onPress={() => setOpen(!open)}
      />
      {open && (
        <>
          <Controller
            control={form.control}
            name="name"
            render={({ field }) => (
              <Field
                label="Boat name"
                value={field.value}
                onChangeText={field.onChange}
                error={form.formState.errors.name?.message as string}
              />
            )}
          />
          <Controller
            control={form.control}
            name="description"
            render={({ field }) => (
              <Field
                label="Description"
                multiline
                value={field.value}
                onChangeText={field.onChange}
              />
            )}
          />
          <Text style={styles.label}>Boat type</Text>
          <View style={styles.row}>
            {(["motorized_bangka", "speedboat", "passenger_boat"] as const).map(
              (t) => (
                <Pressable
                  key={t}
                  style={[
                    styles.pill,
                    form.watch("boat_type") === t && styles.pillSelected,
                  ]}
                  onPress={() => form.setValue("boat_type", t)}
                >
                  <Text style={styles.muted}>{t.replaceAll("_", " ")}</Text>
                </Pressable>
              ),
            )}
          </View>
          <Controller
            control={form.control}
            name="capacity"
            render={({ field }) => (
              <Field
                label="Approved passenger capacity"
                keyboardType="number-pad"
                value={String(field.value)}
                onChangeText={(v) => field.onChange(v)}
                error={form.formState.errors.capacity?.message as string}
              />
            )}
          />
          <Text style={styles.label}>Home port</Text>
          <View style={styles.row}>
            {locations.map((l) => (
              <Pressable
                key={l.id}
                style={[
                  styles.pill,
                  form.watch("home_location_id") === l.id &&
                    styles.pillSelected,
                ]}
                onPress={() => {
                  form.setValue("home_location_id", l.id);
                  const gis = resolvePortGis(l.name, l.latitude, l.longitude);
                  setPickupLabel(gis.landmark);
                }}
              >
                <Text style={styles.muted}>{l.name}</Text>
              </Pressable>
            ))}
          </View>
          <Field
            label="Default GIS boarding bay / landmark"
            placeholder="e.g. Pier 1 Passenger Waiting Shed"
            value={pickupLabel}
            onChangeText={setPickupLabel}
          />
          {(["charter_price", "seat_price"] as const).map((name) => (
            <Controller
              control={form.control}
              name={name}
              key={name}
              render={({ field }) => (
                <Field
                  label={
                    name === "charter_price"
                      ? "Charter price (PHP; 0 disables mode)"
                      : "Seat price (PHP; 0 disables mode)"
                  }
                  keyboardType="decimal-pad"
                  value={String(field.value)}
                  onChangeText={(v) => field.onChange(v)}
                  error={form.formState.errors[name]?.message as string}
                />
              )}
            />
          ))}
          <Button
            title="Save registration draft"
            busy={mutation.isPending}
            onPress={() => mutation.mutate()}
          />
        </>
      )}
    </View>
  );
}

function AttachmentForm({
  boat,
  requirements,
  notify,
}: {
  boat: any;
  requirements: any[];
  notify: (s: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [expires, setExpires] = useState("");
  const applicable = requirements.filter(
    (r) =>
      (!r.boat_type || r.boat_type === boat.boat_type) &&
      (!r.location_id || r.location_id === boat.home_location_id),
  );
  async function upload(requirement?: string) {
    setBusy(true);
    try {
      if (expires && !/^\d{4}-\d{2}-\d{2}$/.test(expires))
        throw new Error("Use YYYY-MM-DD for document expiry.");
      const result = await DocumentPicker.getDocumentAsync({
        type: requirement
          ? ["application/pdf", "image/jpeg", "image/png"]
          : ["image/jpeg", "image/png", "image/webp"],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      if (
        !file.mimeType ||
        !(
          requirement
            ? ["application/pdf", "image/jpeg", "image/png"]
            : ["image/jpeg", "image/png", "image/webp"]
        ).includes(file.mimeType) ||
        !file.size ||
        file.size > (requirement ? 10 : 5) * 1024 * 1024
      )
        throw new Error("Choose a supported file within the size limit.");
      const { data } = await supabase.auth.getUser();
      const path = `${data.user!.id}/${boat.id}/${Crypto.randomUUID()}.${file.mimeType === "application/pdf" ? "pdf" : file.mimeType.split("/")[1]}`;
      const response = await fetch(file.uri);
      const bytes = await response.arrayBuffer();
      const { error } = await supabase.storage
        .from(requirement ? "boat-documents" : "boat-photos")
        .upload(path, bytes, { contentType: file.mimeType, upsert: false });
      if (error) throw error;
      await backend.rpc("add_attachment", {
        p_boat: boat.id,
        p_path: path,
        p_requirement: requirement ?? null,
        p_expires: expires || null,
      });
      notify("File uploaded and attached to your registration.");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.h2}>Photos & required documents</Text>
      <Button
        secondary
        title="Upload boat photo (up to 5 MB)"
        busy={busy}
        onPress={() => upload()}
      />
      <Field
        label="Document expiry (YYYY-MM-DD, if applicable)"
        value={expires}
        onChangeText={setExpires}
      />
      {applicable.map((r) => (
        <Button
          secondary
          key={r.id}
          title={`Upload ${r.name}`}
          busy={busy}
          onPress={() => upload(r.id)}
        />
      ))}
      <Text style={styles.muted}>
        PDF, JPEG or PNG documents up to 10 MB. Private to you and authorized
        reviewers.
      </Text>
    </View>
  );
}

function ScheduleForm({
  boats,
  routes,
  locations,
  notify,
}: {
  boats: any[];
  routes: any[];
  locations: any[];
  notify: (s: string) => void;
}) {
  const [boat, setBoat] = useState(boats[0]?.id ?? "");
  const [route, setRoute] = useState(routes[0]?.id ?? "");
  const [mode, setMode] = useState<"seat" | "charter">("seat");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [capacity, setCapacity] = useState(
    String(boats[0]?.capacity ?? 1),
  );
  const [price, setPrice] = useState(
    boats[0]?.seat_price_minor
      ? String(boats[0].seat_price_minor / 100)
      : "",
  );
  const [pickupLabel, setPickupLabel] = useState(
    boats[0]?.pickup_label || "Pier 1 Boarding Ramp, Abra de Ilog Port",
  );
  const qc = useQueryClient();
  function applyBoatMode(boatId: string, nextMode: "seat" | "charter") {
    setBoat(boatId);
    setMode(nextMode);
    const chosen = boats.find((b) => b.id === boatId);
    if (chosen) {
      setCapacity(String(chosen.capacity ?? 1));
      if (chosen.pickup_label) setPickupLabel(chosen.pickup_label);
      const minor =
        nextMode === "seat"
          ? chosen.seat_price_minor
          : chosen.charter_price_minor;
      if (minor > 0) setPrice(String(minor / 100));
    }
  }
  function applyPreset(hour: string, endHour: string) {
    const tomorrow = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
    }).format(new Date(Date.now() + 86400000));
    setStart(`${tomorrow}T${hour}`);
    setEnd(`${tomorrow}T${endHour}`);
  }
  const mutation = useMutation({
    mutationFn: () => {
      const input = scheduleSchema.parse({
        boat_id: boat,
        route_id: route,
        mode,
        starts_at: new Date(start + "+08:00").toISOString(),
        ends_at: new Date(end + "+08:00").toISOString(),
        capacity: Number(capacity),
        price_minor: Math.round(Number(price) * 100),
      });
      const rObj = routes.find((r) => r.id === route);
      const originLoc = locations.find((l) => l.id === rObj?.origin_id);
      const gis = resolvePortGis(
        originLoc?.name,
        originLoc?.latitude,
        originLoc?.longitude,
        pickupLabel,
      );
      return backend.rpc("save_schedule", {
        p_data: {
          ...input,
          pickup_label: pickupLabel,
          pickup_lat: gis.lat,
          pickup_lng: gis.lng,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries();
      notify("Schedule published with GIS boarding location.");
    },
    onError: (e) => notify(e.message),
  });
  return (
    <View style={styles.card}>
      <Text style={styles.h2}>Publish a schedule</Text>
      {!boats.length ? (
        <Text style={styles.subtitle}>
          An approved active boat is required.
        </Text>
      ) : (
        <>
          <Text style={styles.label}>Boat</Text>
          <View style={styles.row}>
            {boats.map((b) => (
              <Pressable
                key={b.id}
                style={[styles.pill, boat === b.id && styles.pillSelected]}
                onPress={() => applyBoatMode(b.id, mode)}
              >
                <Text style={styles.muted}>{b.name}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Route</Text>
          <View style={styles.row}>
            {routes.map((r) => (
              <Pressable
                key={r.id}
                style={[styles.pill, route === r.id && styles.pillSelected]}
                onPress={() => {
                  setRoute(r.id);
                  const orig = locations.find((l) => l.id === r.origin_id);
                  const gis = resolvePortGis(orig?.name, orig?.latitude, orig?.longitude);
                  setPickupLabel(gis.landmark);
                }}
              >
                <Text style={styles.muted}>
                  {locations.find((l) => l.id === r.origin_id)?.name} →{" "}
                  {locations.find((l) => l.id === r.destination_id)?.name}
                </Text>
              </Pressable>
            ))}
          </View>
          <Field
            label="GIS Pickup / Boarding Bay Landmark"
            placeholder="e.g. Pier 1 Waiting Shed"
            value={pickupLabel}
            onChangeText={setPickupLabel}
          />
          <View style={styles.row}>
            {(["seat", "charter"] as const).map((m) => (
              <Button
                key={m}
                secondary={mode !== m}
                title={m === "seat" ? "Per seat" : "Private charter"}
                onPress={() => applyBoatMode(boat, m)}
              />
            ))}
          </View>
          <View style={styles.row}>
            {[
              ["08:00", "09:00", "Tomorrow 8 AM"],
              ["14:00", "15:00", "Tomorrow 2 PM"],
            ].map(([sh, eh, label]) => (
              <Pressable
                key={label}
                style={[
                  styles.pill,
                  { minHeight: 36, paddingVertical: 6, paddingHorizontal: 11 },
                ]}
                onPress={() => applyPreset(sh, eh)}
              >
                <Text style={{ fontSize: 11, fontWeight: "600", color: c.ocean }}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Field
            label="Departure (YYYY-MM-DDTHH:mm, Philippine time)"
            value={start}
            onChangeText={setStart}
          />
          <Field
            label="Arrival (YYYY-MM-DDTHH:mm, Philippine time)"
            value={end}
            onChangeText={setEnd}
          />
          <Field
            label="Passenger capacity"
            keyboardType="number-pad"
            value={capacity}
            onChangeText={setCapacity}
          />
          <Field
            label={
              mode === "seat"
                ? "Price per seat (PHP)"
                : "Total charter price (PHP)"
            }
            keyboardType="decimal-pad"
            value={price}
            onChangeText={setPrice}
          />
          <Button
            title="Publish schedule"
            busy={mutation.isPending}
            onPress={() => mutation.mutate()}
          />
        </>
      )}
    </View>
  );
}
