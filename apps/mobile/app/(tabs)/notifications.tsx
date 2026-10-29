import React from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { tripDate } from "@bangkago/shared";
import { supabase } from "../../src/client";
import { useSession } from "../../src/session";
import { Screen, Button, State, styles, Badge } from "../../src/ui";
export default function Notifications() {
  const { session } = useSession();
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["notifications", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });
  const unread = query.data?.filter((n) => !n.read_at).length ?? 0;
  return (
    <Screen>
      <View style={styles.between}>
        <View>
          <Text style={styles.title}>Your updates</Text>
          <Text style={styles.subtitle}>Stay in the loop, wherever you go.</Text>
        </View>
        {unread > 0 && <Badge value={`${unread} unread`} />}
      </View>
      {unread > 1 && (
        <Button
          secondary
          title="Mark all as read"
          onPress={async () => {
            const { error } = await supabase
              .from("notifications")
              .update({ read_at: new Date().toISOString() })
              .is("read_at", null)
              .eq("user_id", session!.user.id);
            if (!error) qc.invalidateQueries({ queryKey: ["notifications"] });
          }}
        />
      )}
      {!session ? (
        <Button title="Sign in" onPress={() => router.push("/auth")} />
      ) : query.isPending ? (
        <State loading />
      ) : query.error ? (
        <State error={query.error} retry={() => query.refetch()} />
      ) : !query.data?.length ? (
        <State empty="You're all caught up. Trip and registration updates will appear here." />
      ) : (
        query.data.map((n) => (
          <View style={styles.card} key={n.id}>
            <View style={styles.between}>
              <Text style={styles.h2}>{n.title}</Text>
              {!n.read_at && <Badge value="new" />}
            </View>
            <Text style={styles.subtitle}>{n.body}</Text>
            <Text style={styles.muted}>{tripDate(n.created_at)}</Text>
            {!n.read_at && (
              <Button
                secondary
                title="Mark as read"
                onPress={async () => {
                  const { error } = await supabase
                    .from("notifications")
                    .update({ read_at: new Date().toISOString() })
                    .eq("id", n.id);
                  if (!error)
                    qc.invalidateQueries({ queryKey: ["notifications"] });
                }}
              />
            )}
          </View>
        ))
      )}
    </Screen>
  );
}
