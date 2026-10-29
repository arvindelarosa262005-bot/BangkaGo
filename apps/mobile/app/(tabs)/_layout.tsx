import React from "react";
import { Tabs } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import {
  Compass,
  CalendarDays,
  Ship,
  UserRound,
  Bell,
} from "lucide-react-native";
import { c } from "../../src/ui";
import { useSession } from "../../src/session";
import { supabase, configured } from "../../src/client";
export default function TabLayout() {
  const { session, profile } = useSession();
  const notices = useQuery({
    queryKey: ["notifications", session?.user.id],
    enabled: configured && !!session,
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
  const unread = notices.data?.filter((n: any) => !n.read_at).length ?? 0;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.ocean,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: {
          borderTopColor: c.border,
          height: 80,
          paddingBottom: 12,
          paddingTop: 8,
        },
        tabBarLabelStyle: { fontSize: 10, lineHeight: 14, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Explore",
          tabBarIcon: ({ color }) => <Compass size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "My trips",
          tabBarIcon: ({ color }) => <CalendarDays size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="owner"
        options={{
          title: "My boats",
          href: profile?.role === "owner" ? undefined : null,
          tabBarIcon: ({ color }) => <Ship size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Updates",
          tabBarBadge: unread > 0 ? (unread > 9 ? "9+" : unread) : undefined,
          tabBarIcon: ({ color }) => <Bell size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => <UserRound size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
