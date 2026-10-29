import React, { useState } from "react";
import { Text, View, Pressable } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tripDate } from "@bangkago/shared";
import { supabase } from "../src/client";
import { useSession } from "../src/session";
import { Screen, Field, Button, Badge, styles, c } from "../src/ui";
export default function Support() {
  const { session } = useSession();
  const qc = useQueryClient();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const tickets = useQuery({
    queryKey: ["my-tickets", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_id", session!.user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <Screen>
      <Button secondary title="Back" onPress={() => router.back()} />
      <Text style={styles.title}>We're here to help.</Text>
      <Text style={styles.subtitle}>
        For a booking issue, include the booking reference. Never send payment
        PINs, OTPs, or passwords.
      </Text>
      <View style={styles.card}>
        <Text style={styles.label}>Quick topic</Text>
        <View style={styles.row}>
          {[
            "Booking / Schedule",
            "Payment / GCash",
            "Refund request",
            "Vessel / Safety",
          ].map((topic) => (
            <Pressable
              key={topic}
              style={[
                styles.pill,
                { minHeight: 36, paddingVertical: 6, paddingHorizontal: 11 },
                subject === topic && styles.pillSelected,
              ]}
              onPress={() => setSubject(topic)}
            >
              <Text style={{ fontSize: 11, fontWeight: "600", color: c.navy }}>
                {topic}
              </Text>
            </Pressable>
          ))}
        </View>
        <Field
          label="Subject"
          maxLength={150}
          value={subject}
          onChangeText={setSubject}
        />
        <Field
          label="What happened?"
          multiline
          maxLength={3000}
          value={body}
          onChangeText={setBody}
        />
        <Button
          title="Send support request"
          busy={busy}
          onPress={async () => {
            if (!session) {
              router.push("/auth");
              return;
            }
            if (subject.trim().length < 3 || body.trim().length < 5) {
              setMessage("Please add a subject and a short description.");
              return;
            }
            setBusy(true);
            const { error } = await supabase.from("support_tickets").insert({
              user_id: session.user.id,
              subject: subject.trim(),
              body: body.trim(),
            });
            setMessage(error?.message || "Your support request was received.");
            if (!error) {
              setSubject("");
              setBody("");
              qc.invalidateQueries({ queryKey: ["my-tickets"] });
            }
            setBusy(false);
          }}
        />
      </View>
      {!!message && (
        <Text style={styles.subtitle} accessibilityLiveRegion="polite">
          {message}
        </Text>
      )}
      {!!tickets.data?.length && (
        <View style={{ gap: 12 }}>
          <Text style={styles.h2}>My support tickets</Text>
          {tickets.data.map((t: any) => (
            <View key={t.id} style={styles.card}>
              <View style={styles.between}>
                <Text style={styles.h2}>{t.subject}</Text>
                <Badge value={t.status} />
              </View>
              <Text style={styles.subtitle}>{t.body}</Text>
              <Text style={styles.muted}>{tripDate(t.created_at)}</Text>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}
