import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type ViewStyle,
  type StyleProp,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ship, ArrowRight } from "lucide-react-native";
import { tokens } from "@bangkago/shared";
import { LiveIndicator } from "./live";
export const c = tokens.colors;
export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F8FD" },
  content: {
    padding: 18,
    paddingBottom: 36,
    gap: 14,
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
  },
  title: {
    fontSize: 25,
    fontWeight: "800",
    color: c.navy,
    letterSpacing: -0.7,
  },
  subtitle: { fontSize: 13.5, lineHeight: 20, color: c.muted },
  label: { fontSize: 11.5, fontWeight: "700", color: c.text, marginBottom: 6 },
  input: {
    minHeight: 46,
    borderColor: c.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: c.text,
    backgroundColor: "#fff",
  },
  card: {
    backgroundColor: "#fff",
    borderColor: "#E1ECF8",
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    gap: 12,
    shadowColor: c.navy,
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  h2: { fontSize: 17, fontWeight: "700", color: c.navy, letterSpacing: -0.3 },
  price: { fontSize: 23, fontWeight: "800", color: c.ocean, letterSpacing: -0.5 },
  muted: { fontSize: 12, lineHeight: 18, color: c.muted },
  error: { fontSize: 13, color: c.error, lineHeight: 19 },
  badge: {
    backgroundColor: c.ice,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  badgeText: { fontSize: 10.5, fontWeight: "700", color: c.ocean, textTransform: "capitalize" },
  pill: {
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#DCE7F5",
    borderRadius: 11,
    backgroundColor: "white",
  },
  pillSelected: { backgroundColor: c.ice, borderColor: c.ocean },
  empty: { padding: 24, alignItems: "center", gap: 10 },
  hero: {
    padding: 22,
    backgroundColor: c.navy,
    borderRadius: 20,
    gap: 8,
    overflow: "hidden",
  },
  heroTitle: {
    fontSize: 26,
    color: "white",
    fontWeight: "800",
    lineHeight: 32,
  },
  heroText: { color: "#c5dcf8", fontSize: 13, lineHeight: 20 },
  hr: { height: 1, backgroundColor: c.border },
  image: { height: 175, width: "100%", borderRadius: 12 },
  link: { color: c.ocean, fontWeight: "700", fontSize: 12.5 },
  field: { gap: 0 },
});
export function Screen({
  children,
  wide = false,
  hideLive = false,
  contentStyle,
}: {
  children: React.ReactNode;
  wide?: boolean;
  hideLive?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { width } = useWindowDimensions();
  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          wide && { maxWidth: 1120 },
          width > 800 && { padding: 32 },
          contentStyle,
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {!hideLive && <LiveIndicator />}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}
export function Brand({ light = false }: { light?: boolean }) {
  return (
    <View style={styles.row}>
      <View style={{ backgroundColor: c.ocean, padding: 10, borderRadius: 13 }}>
        <Ship color="white" size={25} />
      </View>
      <View>
        <Text
          style={{
            fontSize: 25,
            fontWeight: "800",
            color: light ? "white" : c.navy,
            letterSpacing: -0.8,
          }}
        >
          Bangka<Text style={{ color: light ? "#92C7FF" : c.ocean }}>Go</Text>
        </Text>
        <Text
          style={{
            fontSize: 9,
            letterSpacing: 1.3,
            color: light ? "#B5CDE9" : c.muted,
          }}
        >
          YOUR JOURNEY, YOUR BOAT.
        </Text>
      </View>
    </View>
  );
}
export function Button({
  title,
  onPress,
  busy,
  disabled,
  secondary = false,
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy }}
      aria-disabled={!!(disabled || busy)}
      aria-busy={!!busy}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        backgroundColor: secondary ? "white" : c.ocean,
        borderColor: secondary ? c.border : c.ocean,
        borderWidth: 1,
        borderRadius: 14,
        padding: 14,
        opacity: disabled || busy?.valueOf() ? 0.5 : pressed ? 0.8 : 1,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 10,
      })}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? c.ocean : "white"} />
      ) : (
        <>
          <Text
            style={{
              color: secondary ? c.text : "white",
              fontWeight: "600",
              fontSize: 14,
            }}
          >
            {title}
          </Text>
          {!secondary && <ArrowRight size={17} color="white" />}
        </>
      )}
    </Pressable>
  );
}
export function Field({
  label,
  error,
  icon,
  accessory,
  ...props
}: TextInputProps & {
  label: string;
  error?: string;
  icon?: React.ReactNode;
  accessory?: React.ReactNode;
}) {
  const [focused, setFocused] = React.useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.input,
          {
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            paddingVertical: 0,
            borderColor: error ? c.error : focused ? c.ocean : c.border,
            backgroundColor: focused ? "#F7FBFF" : "white",
          },
        ]}
      >
        {icon}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor="#9aaabd"
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 50,
            fontSize: 14,
            color: c.text,
            paddingVertical: 12,
          }}
          {...props}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
        />
        {accessory}
      </View>
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}
export function Badge({ value }: { value: string }) {
  const good = [
      "approved",
      "paid",
      "confirmed",
      "completed",
      "settled",
      "active",
    ].includes(value),
    bad = ["cancelled", "rejected", "suspended", "failed", "expired"].includes(
      value,
    ),
    pending = [
      "awaiting_payment",
      "pending_owner_confirmation",
      "refund_pending",
      "submitted",
      "under_review",
      "pending",
    ].includes(value);
  const toneColor = good
    ? c.success
    : bad
      ? c.error
      : pending
        ? "#9A610C"
        : c.ocean;
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: good
            ? "#EEF9F1"
            : bad
              ? "#FFF1F2"
              : pending
                ? "#FFF7E9"
                : c.ice,
        },
      ]}
    >
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: toneColor,
        }}
      />
      <Text
        style={[
          styles.badgeText,
          {
            color: toneColor,
          },
        ]}
      >
        {value.replaceAll("_", " ")}
      </Text>
    </View>
  );
}
export function State({
  loading,
  error,
  empty,
  retry,
}: {
  loading?: boolean;
  error?: Error | null;
  empty?: string;
  retry?: () => void;
}) {
  return (
    <View style={styles.empty}>
      {loading ? (
        <ActivityIndicator size="large" color={c.ocean} />
      ) : (
        <Ship size={30} color={c.ocean} />
      )}
      <Text style={error ? styles.error : styles.subtitle}>
        {loading ? "Loading your journeys…" : error ? error.message : empty}
      </Text>
      {error && retry && <Button secondary title="Try again" onPress={retry} />}
    </View>
  );
}
