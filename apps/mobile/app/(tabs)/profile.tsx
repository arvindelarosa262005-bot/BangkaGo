import React, { useState, useEffect } from "react";
import { Text, View, Switch } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isRunningInExpoGo } from "expo";
import { backend, supabase } from "../../src/client";
import { useSession } from "../../src/session";
import {
  Screen,
  Brand,
  Button,
  Field,
  Badge,
  State,
  styles,
} from "../../src/ui";
export default function Profile() {
  const { session, profile, loading, error } = useSession();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  useEffect(() => {
    setName(profile?.display_name ?? "");
    setPhone(profile?.phone ?? "");
  }, [profile]);
  const saved = useQuery({
    queryKey: ["saved", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_boats")
        .select("boat_id,boats(name)")
        .eq("user_id", session!.user.id);
      if (error) throw error;
      return data;
    },
  });
  async function save() {
    setBusy(true);
    if (
      name.trim().length < 2 ||
      (phone && !/^\+?[\d\s-]{7,18}$/.test(phone))
    ) {
      setMessage("Enter a valid name and contact number.");
      setBusy(false);
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: name.trim(), phone: phone || null })
      .eq("id", session!.user.id);
    setMessage(error?.message || "Profile updated.");
    qc.invalidateQueries({ queryKey: ["profile"] });
    setBusy(false);
  }
  return (
    <Screen>
      <Brand />
      <Text style={styles.title}>Your account</Text>
      {loading ? (
        <State loading />
      ) : error ? (
        <State error={error} />
      ) : !session ? (
        <>
          <Text style={styles.subtitle}>
            Keep your trips, saved boats, and updates together.
          </Text>
          <Button
            title="Sign in or register"
            onPress={() => router.push("/auth")}
          />
        </>
      ) : (
        <>
          <View style={styles.card}>
            <View style={styles.between}>
              <Text style={styles.h2}>{profile?.display_name}</Text>
              <Badge
                value={
                  session.user.app_metadata?.provider === "google"
                    ? "google account"
                    : (profile?.role ?? "passenger")
                }
              />
            </View>
            <Text style={styles.muted}>
              {session.user.email} · {profile?.role}
            </Text>
            <Field label="Display name" value={name} onChangeText={setName} />
            <Field
              label="Contact phone"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            <Button title="Save profile" busy={busy} onPress={save} />
            <View style={styles.between}>
              <Text style={styles.subtitle}>In-app notifications</Text>
              <Switch
                accessibilityLabel="Enable notifications"
                value={profile?.notifications_enabled}
                onValueChange={async (v) => {
                  const { error } = await supabase
                    .from("profiles")
                    .update({ notifications_enabled: v })
                    .eq("id", session.user.id);
                  setMessage(error?.message || "Preference saved.");
                  qc.invalidateQueries({ queryKey: ["profile"] });
                }}
              />
            </View>
            <Button
              secondary
              title="Enable push notifications"
              onPress={async () => {
                try {
                  if (isRunningInExpoGo())
                    throw new Error(
                      "Push notifications are available in the BangkaGo APK. You can still receive in-app updates in Expo Go.",
                    );
                  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
                  if (!projectId)
                    throw new Error(
                      "Push notifications are not available in this build yet.",
                    );
                  const Notifications = await import("expo-notifications");
                  await Notifications.setNotificationChannelAsync("trips", {
                    name: "Trip updates",
                    importance: Notifications.AndroidImportance.DEFAULT,
                  });
                  const permission =
                    await Notifications.requestPermissionsAsync();
                  if (permission.status !== "granted")
                    throw new Error("Notification permission was not granted.");
                  const token = (
                    await Notifications.getExpoPushTokenAsync({ projectId })
                  ).data;
                  const { error } = await supabase
                    .from("profiles")
                    .update({ push_token: token })
                    .eq("id", session.user.id);
                  if (error) throw error;
                  setMessage(
                    "Device registered for push. Server delivery must be configured.",
                  );
                } catch (e) {
                  setMessage(
                    e instanceof Error
                      ? e.message
                      : "Unable to register notifications.",
                  );
                }
              }}
            />
          </View>
          {profile?.role === "passenger" && (
            <View style={styles.card}>
              <Text style={styles.h2}>Own or captain a boat?</Text>
              <Text style={styles.muted}>
                Activate your operator workspace to register vessels, upload
                safety permits, and publish schedules for passengers.
              </Text>
              <Button
                secondary
                title="Become a boat operator"
                busy={busy}
                onPress={async () => {
                  setBusy(true);
                  try {
                    await backend.rpc("register_as_owner");
                    await qc.invalidateQueries({ queryKey: ["profile"] });
                    setMessage(
                      "Operator workspace enabled! Open the Operator tab to register your boat.",
                    );
                  } catch (e) {
                    setMessage(
                      e instanceof Error
                        ? e.message
                        : "Unable to enable operator workspace.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </View>
          )}
          <Text style={styles.h2}>Saved boats</Text>
          {saved.error ? (
            <State error={saved.error} />
          ) : !saved.data?.length ? (
            <Text style={styles.muted}>Save a boat from its trip details.</Text>
          ) : (
            saved.data.map((b: any) => (
              <View key={b.boat_id} style={styles.card}>
                <Text style={styles.subtitle}>
                  {b.boats?.name ?? "Boat no longer publicly available"}
                </Text>
                <Button
                  secondary
                  title="Remove saved boat"
                  onPress={async () => {
                    const { error } = await supabase
                      .from("saved_boats")
                      .delete()
                      .eq("user_id", session.user.id)
                      .eq("boat_id", b.boat_id);
                    setMessage(error?.message || "Removed.");
                    qc.invalidateQueries({ queryKey: ["saved"] });
                  }}
                />
              </View>
            ))
          )}
          <Button
            secondary
            title="Booking history"
            onPress={() => router.push("/(tabs)/bookings")}
          />
          <Button
            secondary
            title="Help & support"
            onPress={() => router.push("/support")}
          />
          <Button
            secondary
            title="Sign out"
            onPress={async () => {
              await supabase.auth.signOut();
              qc.clear();
              router.replace("/(tabs)");
            }}
          />
        </>
      )}
      <Button
        secondary
        title="Terms & privacy"
        onPress={() => router.push("/legal")}
      />
      {!!message && (
        <Text style={styles.subtitle} accessibilityLiveRegion="polite">
          {message}
        </Text>
      )}
    </Screen>
  );
}
