import React, { useState, useEffect } from "react";
import { Text, View, Switch, Pressable } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import {
  bookingSchema,
  php,
  tripDate,
  durationLabel,
} from "@bangkago/shared";
import { backend, supabase, configured } from "../../src/client";
import { Screen, Button, Field, Badge, State, styles, c } from "../../src/ui";
import { useSession } from "../../src/session";
import { BoatPhoto } from "../(tabs)/index";
export default function Details() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const qc = useQueryClient();
  const [count, setCount] = useState("1");
  const [instructions, setInstructions] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [key, setKey] = useState(Crypto.randomUUID());
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    AsyncStorage.getItem("recent-boats").then((v) =>
      AsyncStorage.setItem(
        "recent-boats",
        JSON.stringify(
          [
            id,
            ...(v ? JSON.parse(v) : []).filter((x: string) => x !== id),
          ].slice(0, 10),
        ),
      ),
    );
  }, [id]);
  useEffect(() => {
    setKey(Crypto.randomUUID());
  }, [id, count, instructions]);
  const trip = useQuery({
    queryKey: ["trip", id],
    enabled: configured,
    queryFn: async () => {
      const data = await backend.rpc("available_schedules");
      const row = (data as any[]).find((s) => s.id === id);
      if (!row) throw new Error("This schedule is no longer available.");
      return row;
    },
  });
  const quote = useQuery({
    queryKey: ["quote", id, count],
    enabled: !!trip.data && Number(count) > 0,
    queryFn: () =>
      backend.rpc("quote_booking", { p_schedule: id, p_count: Number(count) }),
  });
  const s = trip.data;
  useEffect(() => {
    if (!session || !s?.boat_id) return;
    supabase
      .from("saved_boats")
      .select("boat_id")
      .eq("user_id", session.user.id)
      .eq("boat_id", s.boat_id)
      .maybeSingle()
      .then(({ data }) => setSaved(!!data));
  }, [session?.user.id, s?.boat_id]);
  const reviews = useQuery({
    queryKey: ["reviews", s?.boat_id],
    enabled: configured && !!s?.boat_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("boat_id", s.boat_id)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });
  useEffect(() => setAccepted(false), [quote.data?.total_minor]);
  const reserve = useMutation({
    mutationFn: async () => {
      const input = bookingSchema.parse({
        schedule_id: id,
        passenger_count: Number(count),
        idempotency_key: key,
        policy_accepted: accepted,
        instructions,
      });
      if (!session) {
        router.push("/auth");
        throw new Error("Sign in to reserve your journey.");
      }
      return backend.edge("create-booking", input);
    },
    onSuccess: () => {
      qc.invalidateQueries();
      router.push("/(tabs)/bookings");
    },
    onError: (e) => setMessage(e.message),
  });
  async function save() {
    if (!session) {
      router.push("/auth");
      return;
    }
    const result = saved
      ? await supabase
          .from("saved_boats")
          .delete()
          .eq("user_id", session.user.id)
          .eq("boat_id", s.boat_id)
      : await supabase
          .from("saved_boats")
          .upsert({ user_id: session.user.id, boat_id: s.boat_id });
    if (result.error) setMessage(result.error.message);
    else {
      setSaved(!saved);
      qc.invalidateQueries({ queryKey: ["saved"] });
    }
  }
  const avgRating =
    reviews.data && reviews.data.length > 0
      ? (
          reviews.data.reduce((sum, r) => sum + Number(r.rating), 0) /
          reviews.data.length
        ).toFixed(1)
      : null;
  return (
    <Screen>
      <Button secondary title="Back to explore" onPress={() => router.back()} />
      {trip.isPending ? (
        <State loading />
      ) : trip.error ? (
        <State error={trip.error} retry={() => trip.refetch()} />
      ) : (
        s && (
          <>
            <BoatPhoto path={s.photo_path} />
            <View style={styles.row}>
              <Badge value="verified operator" />
              <Badge
                value={s.mode === "seat" ? "shared trip" : "private charter"}
              />
              {!!avgRating && (
                <Badge
                  value={`★ ${avgRating} (${reviews.data?.length})`}
                />
              )}
            </View>
            <Text style={styles.title}>{s.boat_name}</Text>
            <Text style={styles.subtitle}>
              {s.description ||
                "Enjoy your journey with a verified local boat operator."}
            </Text>
            <View style={styles.card}>
              <View style={styles.between}>
                <Text style={styles.h2}>
                  {s.origin} → {s.destination}
                </Text>
                {!!s.ends_at && (
                  <Badge value={durationLabel(s.starts_at, s.ends_at)} />
                )}
              </View>
              <Text style={styles.subtitle}>{tripDate(s.starts_at)}</Text>
              <Text style={styles.muted}>Arrival: {tripDate(s.ends_at)}</Text>
              <Text style={styles.muted}>
                {s.capacity} passenger capacity · {s.remaining} available
              </Text>
              <Text style={styles.muted}>
                {s.owner_name} ·{" "}
                {s.mode === "seat" ? "Shared trip" : "Private charter"}
              </Text>
              <Text style={styles.price}>{php(s.price_minor)}</Text>
              <Text style={styles.muted}>
                {s.mode === "seat" ? "per passenger" : "whole boat"}
              </Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.h2}>Plan your journey</Text>
              <Field
                label="Passenger count"
                keyboardType="number-pad"
                value={count}
                onChangeText={setCount}
                accessory={
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Decrease passenger count"
                      onPress={() =>
                        setCount(String(Math.max(1, Number(count || 1) - 1)))
                      }
                      style={[
                        styles.pill,
                        { minHeight: 36, paddingHorizontal: 12, paddingVertical: 4 },
                      ]}
                    >
                      <Text style={{ fontWeight: "700", color: c.navy }}>−</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Increase passenger count"
                      onPress={() =>
                        setCount(
                          String(
                            Math.min(
                              s.remaining || s.capacity,
                              Number(count || 1) + 1,
                            ),
                          ),
                        )
                      }
                      style={[
                        styles.pill,
                        { minHeight: 36, paddingHorizontal: 12, paddingVertical: 4 },
                      ]}
                    >
                      <Text style={{ fontWeight: "700", color: c.navy }}>+</Text>
                    </Pressable>
                  </View>
                }
              />
              <Field
                label="Special instructions (optional)"
                multiline
                maxLength={500}
                value={instructions}
                onChangeText={setInstructions}
              />
              <Text style={styles.h2}>Price breakdown</Text>
              {quote.isPending ? (
                <State loading />
              ) : quote.error ? (
                <State error={quote.error} />
              ) : (
                <>
                  <View style={styles.between}>
                    <Text style={styles.subtitle}>Base fare</Text>
                    <Text style={styles.subtitle}>
                      {php(quote.data.base_minor)}
                    </Text>
                  </View>
                  <View style={styles.between}>
                    <Text style={styles.subtitle}>Service fee</Text>
                    <Text style={styles.subtitle}>
                      {php(quote.data.service_fee_minor)}
                    </Text>
                  </View>
                  <View style={styles.between}>
                    <Text style={styles.h2}>Total payable</Text>
                    <Text style={styles.price}>
                      {php(quote.data.total_minor)}
                    </Text>
                  </View>
                  <Text style={styles.muted}>
                    PHP · No additional taxes or discounts configured. The
                    backend validates the final fare on reservation.
                  </Text>
                </>
              )}
              <Text style={styles.h2}>Cancellation policy</Text>
              <Text style={styles.subtitle}>{s.cancellation_policy}</Text>
              <View style={styles.row}>
                <Switch
                  accessibilityLabel="I accept the cancellation policy"
                  value={accepted}
                  onValueChange={setAccepted}
                />
                <Text style={[styles.muted, { flex: 1 }]}>
                  I acknowledge the fare, trip details, and cancellation policy.
                </Text>
              </View>
              <Button
                title={session ? "Request booking" : "Sign in to book"}
                busy={reserve.isPending}
                disabled={!accepted || !quote.data || !!quote.error}
                onPress={() => reserve.mutate()}
              />
              <Text style={styles.muted}>
                A request holds capacity for up to 30 minutes. Payment opens
                after operator acceptance.
              </Text>
            </View>
            <Button
              secondary
              title={saved ? "Remove saved boat" : "Save this boat"}
              onPress={save}
            />
            {!!reviews.data?.length && (
              <View style={styles.card}>
                <View style={styles.between}>
                  <Text style={styles.h2}>Verified passenger reviews</Text>
                  {!!avgRating && <Badge value={`★ ${avgRating} / 5`} />}
                </View>
                {reviews.data.map((r: any) => (
                  <View
                    key={r.id}
                    style={{
                      paddingTop: 10,
                      borderTopWidth: 1,
                      borderTopColor: c.border,
                      gap: 4,
                    }}
                  >
                    <View style={styles.between}>
                      <Text style={{ fontWeight: "700", color: c.navy, fontSize: 13 }}>
                        {"★".repeat(r.rating)}
                        {"☆".repeat(5 - r.rating)}
                      </Text>
                      <Text style={styles.muted}>{tripDate(r.created_at)}</Text>
                    </View>
                    {!!r.body && <Text style={styles.subtitle}>{r.body}</Text>}
                  </View>
                ))}
              </View>
            )}
            <View style={styles.card}>
              <Text style={styles.h2}>Safety first</Text>
              <Text style={styles.subtitle}>
                Wear a life jacket. Follow the operator’s passenger and weather
                guidance. Never board an overloaded boat. Private verification
                documents are reviewed by administrators.
              </Text>
              <Text style={styles.muted}>
                Operator contact becomes available for an accepted booking in My
                trips.
              </Text>
            </View>
          </>
        )
      )}
      {!!message && (
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {message}
        </Text>
      )}
    </Screen>
  );
}
