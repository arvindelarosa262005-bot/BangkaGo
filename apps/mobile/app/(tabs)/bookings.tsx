import React, { useState } from "react";
import { Text, View, Linking, Pressable } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { router } from "expo-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { php, tripDate, durationLabel, bookingViewStatus } from "@bangkago/shared";
import { backend, supabase } from "../../src/client";
import { useSession } from "../../src/session";
import { GisRouteCard } from "../../src/GisMap";
import { BookingContact, OperatorContactCard } from "../../src/BookingContact";
import { Screen, Button, Field, Badge, State, styles, c } from "../../src/ui";
const journeySteps = [
  ["pending_owner_confirmation", "Requested"],
  ["awaiting_payment", "Payment"],
  ["confirmed", "Confirmed"],
  ["completed", "Completed"],
] as const;
export default function Bookings() {
  const { session, loading, error } = useSession();
  const [reason, setReason] = useState("Change of travel plans");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [filter, setFilter] = useState("all");
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["my-bookings", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const full = await supabase
        .from("bookings")
        .select(
          "*,boats(name,vessel_size,capacity,contact_phone,messenger_url,other_contact,photo_url),boat_schedules(starts_at,ends_at),payments(status,amount_minor)",
        )
        .eq("passenger_id", session!.user.id)
        .order("created_at", { ascending: false });
      if (!full.error) return full.data;
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "*,boats(name),boat_schedules(starts_at,ends_at),payments(status,amount_minor)",
        )
        .eq("passenger_id", session!.user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const action = useMutation({
    mutationFn: async ({ b, operation }: { b: any; operation: string }) => {
      if (operation === "pay") {
        const result = await backend.edge("create-payment-checkout", {
          booking_id: b.id,
        });
        if (result?.paid_directly) {
          return "paid_directly";
        }
        if (
          !result?.checkout_url ||
          new URL(result.checkout_url).hostname !== "checkout.paymongo.com"
        )
          throw new Error("Provider returned an invalid checkout link.");
        await Linking.openURL(result.checkout_url);
        return;
      }
      if (operation === "contact") {
        const rows = await backend.rpc("booking_contact", { p_id: b.id });
        if (!rows?.[0]?.phone)
          throw new Error(
            "Contact number unavailable. Please open a support ticket.",
          );
        const phone = String(rows[0].phone).replace(/[^+\d]/g, "");
        if (!phone) throw new Error("Operator contact number is invalid.");
        await Linking.openURL("tel:" + phone);
        return;
      }
      if (operation === "review") {
        const { error } = await supabase.from("reviews").insert({
          booking_id: b.id,
          passenger_id: session!.user.id,
          boat_id: b.boat_id,
          rating: 5,
          body: reason,
        });
        if (error) throw error;
        return;
      }
      return backend.rpc("booking_action", {
        p_id: b.id,
        p_action: operation,
        p_reason: reason,
      });
    },
    onSuccess: (res) => {
      qc.invalidateQueries();
      setMessage(
        res === "paid_directly"
          ? "GCash payment verified! Your booking is now confirmed and your digital boarding pass is ready."
          : "Updated. Payment status changes only after server verification.",
      );
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
  if (!session)
    return (
      <Screen>
        <Text style={styles.title}>Your journeys</Text>
        <Text style={styles.subtitle}>
          Sign in to view your bookings and payment status.
        </Text>
        <Button title="Sign in" onPress={() => router.push("/auth")} />
      </Screen>
    );
  const rows = (list.data ?? []) as any[];
  const filteredRows = rows.filter((b) => {
    const st = bookingViewStatus(b);
    if (filter === "active")
      return [
        "pending_owner_confirmation",
        "awaiting_payment",
        "confirmed",
      ].includes(st);
    if (filter === "completed") return st === "completed";
    if (filter === "closed")
      return [
        "cancelled",
        "rejected",
        "expired",
        "refund_pending",
        "refunded",
      ].includes(st);
    return true;
  });
  return (
    <Screen>
      <Text style={styles.title}>Your journeys</Text>
      <Text style={styles.subtitle}>
        From your first request to your next shore.
      </Text>
      <View style={styles.row}>
        {[
          ["all", "All"],
          ["active", "Active"],
          ["completed", "Completed"],
          ["closed", "Cancelled / Refunded"],
        ].map(([val, label]) => (
          <Pressable
            key={val}
            style={[styles.pill, filter === val && styles.pillSelected]}
            onPress={() => setFilter(val)}
          >
            <Text style={styles.link}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <Button
        secondary
        title="Refresh bookings"
        onPress={() => list.refetch()}
      />
      {list.isPending ? (
        <State loading />
      ) : list.error ? (
        <State error={list.error} retry={() => list.refetch()} />
      ) : !filteredRows.length ? (
        <State
          empty={
            rows.length
              ? "No bookings match this filter."
              : "No journeys booked yet. Discover an available trip in Explore."
          }
        />
      ) : (
        filteredRows.map((b) => {
          const st = bookingViewStatus(b);
          const stepIndex = journeySteps.findIndex(([k]) => k === st);
          return (
            <View style={styles.card} key={b.id}>
              <View style={styles.between}>
                <Text style={styles.h2}>{b.boats?.name ?? "Boat"}</Text>
                <Badge value={st} />
              </View>
              <Text style={styles.link}>{b.reference}</Text>
              {stepIndex >= 0 && (
                <View
                  style={{
                    flexDirection: "row",
                    gap: 6,
                    paddingVertical: 6,
                  }}
                >
                  {journeySteps.map(([, label], idx) => (
                    <View key={label} style={{ flex: 1, gap: 4 }}>
                      <View
                        style={{
                          height: 5,
                          borderRadius: 3,
                          backgroundColor:
                            idx <= stepIndex ? c.ocean : c.border,
                        }}
                      />
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: idx === stepIndex ? "700" : "500",
                          color: idx <= stepIndex ? c.navy : c.muted,
                        }}
                      >
                        {label}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              <Text style={styles.subtitle}>
                {b.boat_schedules
                  ? tripDate(b.boat_schedules.starts_at)
                  : "Schedule unavailable"}
              </Text>
              <Text style={styles.muted}>
                {b.passenger_count} passengers ·{" "}
                {b.mode === "seat" ? "Per seat" : "Private charter"}
              </Text>
              <Text style={styles.price}>{php(b.total_minor)}</Text>
              <Text style={styles.muted}>
                Payment:{" "}
                {(Array.isArray(b.payments) ? b.payments[0] : b.payments)
                  ?.status ?? "not started"}{" "}
                · verified paid:{" "}
                {php(
                  (Array.isArray(b.payments) ? b.payments[0] : b.payments)
                    ?.status === "paid"
                    ? (Array.isArray(b.payments) ? b.payments[0] : b.payments)
                        .amount_minor
                    : 0,
                )}
              </Text>
              {["pending_owner_confirmation", "awaiting_payment"].includes(
                st,
              ) && (
                <Text style={styles.muted}>
                  Reservation ends: {tripDate(b.reservation_expires_at)}
                </Text>
              )}
              <GisRouteCard
                compact={
                  !["pending_owner_confirmation", "awaiting_payment", "confirmed"].includes(
                    st,
                  )
                }
                originName={b.pickup_label || "Abra de Ilog Port"}
                pickupLabel={b.pickup_label}
                pickupLat={b.pickup_lat}
                pickupLng={b.pickup_lng}
                reminderNote={b.pickup_reminder}
                reminderSentAt={
                  b.reminder_sent_at ? tripDate(b.reminder_sent_at) : undefined
                }
              />
              {st === "awaiting_payment" && (
                <Button
                  title="Pay with GCash"
                  busy={action.isPending}
                  onPress={() => action.mutate({ b, operation: "pay" })}
                />
              )}
              <OperatorContactCard
                compact
                ownerName={b.boats?.name ?? "Boat Operator"}
                phone={b.boats?.contact_phone}
                messengerUrl={b.boats?.messenger_url}
                otherContact={b.boats?.other_contact}
              />
              {[
                "pending_owner_confirmation",
                "awaiting_payment",
                "confirmed",
                "completed",
              ].includes(st) && <BookingContact id={b.id} />}
              {[
                "pending_owner_confirmation",
                "awaiting_payment",
                "confirmed",
              ].includes(st) && (
                <>
                  {cancellingId === b.id ? (
                    <View style={{ gap: 8 }}>
                      <Field
                        label="Reason for cancellation"
                        value={reason}
                        onChangeText={setReason}
                        placeholder="At least 5 characters"
                      />
                      <Button
                        secondary
                        title="Confirm cancellation"
                        busy={action.isPending}
                        onPress={() => {
                          action.mutate({ b, operation: "cancel" });
                          setCancellingId(null);
                        }}
                      />
                    </View>
                  ) : (
                    <Button
                      secondary
                      title="Cancel booking"
                      busy={action.isPending}
                      onPress={() => setCancellingId(b.id)}
                    />
                  )}
                </>
              )}
              <BoardingPass booking={b} status={st} />
              {st === "completed" && (
                <ReviewForm booking={b} notify={setMessage} />
              )}
            </View>
          );
        })
      )}
      {!!message && (
        <Text style={styles.subtitle} accessibilityLiveRegion="polite">
          {message}
        </Text>
      )}
      <Button
        secondary
        title="Get help with a booking"
        onPress={() => router.push("/support")}
      />
    </Screen>
  );
}
function ReferenceMatrix({ code }: { code: string }) {
  const size = 9;
  const cells: boolean[][] = [];
  for (let r = 0; r < size; r++) {
    cells[r] = [];
    for (let col = 0; col < size; col++) {
      const isCorner =
        (r < 3 && col < 3) ||
        (r < 3 && col >= size - 3) ||
        (r >= size - 3 && col < 3);
      if (isCorner) {
        const inner =
          (r === 1 && col === 1) ||
          (r === 1 && col === size - 2) ||
          (r === size - 2 && col === 1);
        const border =
          r === 0 ||
          r === 2 ||
          r === size - 3 ||
          r === size - 1 ||
          col === 0 ||
          col === 2 ||
          col === size - 3 ||
          col === size - 1;
        cells[r][col] = inner || border;
      } else {
        const charIdx = (r * size + col) % Math.max(1, code.length);
        const charCode = code.charCodeAt(charIdx) + r * 17 + col * 31;
        cells[r][col] = charCode % 2 === 0;
      }
    }
  }
  return (
    <Svg width={90} height={90} viewBox="0 0 90 90">
      <Rect x="0" y="0" width="90" height="90" rx="10" fill="#FFFFFF" />
      {cells.map((row, r) =>
        row.map((filled, col) =>
          filled ? (
            <Rect
              key={`${r}-${col}`}
              x={9 + col * 8}
              y={9 + r * 8}
              width={6.5}
              height={6.5}
              rx={1.5}
              fill={c.navy}
            />
          ) : null,
        ),
      )}
    </Svg>
  );
}
function BoardingPass({ booking, status }: { booking: any; status: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 10 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={open ? "Hide boarding pass" : "Show boarding pass"}
        onPress={() => setOpen(!open)}
        style={[
          styles.pill,
          { minHeight: 40, justifyContent: "center" },
          open && styles.pillSelected,
        ]}
      >
        <Text style={styles.link}>
          {open ? "Hide boarding pass" : "Show digital boarding pass"}
        </Text>
      </Pressable>
      {open && (
        <View
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "#C8DDF8",
            backgroundColor: "#F5F9FF",
            padding: 16,
            gap: 12,
          }}
        >
          <View style={styles.between}>
            <View>
              <Text
                style={{
                  fontSize: 9,
                  letterSpacing: 1.5,
                  color: c.ocean,
                  fontWeight: "700",
                }}
              >
                BANGKAGO BOARDING PASS
              </Text>
              <Text style={styles.h2}>{booking.reference}</Text>
            </View>
            <Badge value={status} />
          </View>
          <View
            style={{
              flexDirection: "row",
              gap: 14,
              alignItems: "center",
              backgroundColor: "#FFFFFF",
              padding: 12,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: c.border,
            }}
          >
            <ReferenceMatrix code={String(booking.reference || booking.id)} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ fontWeight: "700", color: c.navy, fontSize: 15 }}>
                {booking.boats?.name ?? "Verified Vessel"}
              </Text>
              <Text style={styles.muted}>
                {booking.passenger_count}{" "}
                {booking.passenger_count === 1 ? "passenger" : "passengers"} ·{" "}
                {booking.mode === "seat" ? "Per seat" : "Private charter"}
              </Text>
              {!!booking.boat_schedules?.starts_at && (
                <Text style={styles.muted}>
                  Departs: {tripDate(booking.boat_schedules.starts_at)}
                </Text>
              )}
              {Boolean(
                booking.boat_schedules?.starts_at &&
                  booking.boat_schedules?.ends_at,
              ) && (
                <Text style={styles.muted}>
                  Est. crossing:{" "}
                  {durationLabel(
                    booking.boat_schedules.starts_at,
                    booking.boat_schedules.ends_at,
                  )}
                </Text>
              )}
            </View>
          </View>
          {!!booking.instructions && (
            <Text style={styles.muted}>
              Passenger notes: {booking.instructions}
            </Text>
          )}
          <Text style={{ fontSize: 11, color: c.muted }}>
            Present this boarding pass and reference ({booking.reference}) to
            your boat operator at the port before departure.
          </Text>
        </View>
      )}
    </View>
  );
}
function ReviewForm({
  booking,
  notify,
}: {
  booking: any;
  notify: (s: string) => void;
}) {
  const [rating, setRating] = useState("5");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const { session } = useSession();
  return (
    <View style={{ gap: 12 }}>
      <Text style={styles.h2}>Review your trip</Text>
      <View style={styles.row}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            style={[
              styles.pill,
              { minHeight: 40, paddingHorizontal: 13 },
              Number(rating) === n && styles.pillSelected,
            ]}
            onPress={() => setRating(String(n))}
          >
            <Text style={{ fontWeight: "700", color: c.ocean }}>
              {n} ★
            </Text>
          </Pressable>
        ))}
      </View>
      <Field
        label="Rating (1–5)"
        keyboardType="number-pad"
        value={rating}
        onChangeText={setRating}
      />
      <Field
        label="Your experience"
        multiline
        maxLength={1000}
        value={body}
        onChangeText={setBody}
      />
      <Button
        secondary
        title="Submit review"
        busy={busy}
        onPress={async () => {
          setBusy(true);
          if (
            !Number.isInteger(Number(rating)) ||
            Number(rating) < 1 ||
            Number(rating) > 5
          ) {
            notify("Choose a rating from 1 to 5.");
            setBusy(false);
            return;
          }
          const { error } = await supabase.from("reviews").insert({
            booking_id: booking.id,
            boat_id: booking.boat_id,
            passenger_id: session!.user.id,
            rating: Number(rating),
            body,
          });
          notify(error?.message || "Thank you. Your trip review was saved.");
          setBusy(false);
        }}
      />
    </View>
  );
}
