import React, { useState } from "react";
import { Linking, Pressable, Text, View } from "react-native";
import { Phone, MessageCircle, MessageSquare, Share2 } from "lucide-react-native";
import { backend } from "./client";
import { Button, styles, c } from "./ui";

export function normalizeMessengerUrl(raw?: string | null): string | null {
  const val = (raw ?? "").trim();
  if (!val) return null;
  if (val.startsWith("http://") || val.startsWith("https://")) return val;
  if (val.startsWith("m.me/") || val.startsWith("facebook.com/")) {
    return `https://${val}`;
  }
  const cleanHandle = val.replace(/^@/, "").replace(/\s+/g, "");
  return `https://m.me/${cleanHandle}`;
}

export function OperatorContactCard({
  ownerName,
  phone,
  messengerUrl,
  otherContact,
  compact = false,
}: {
  ownerName?: string;
  phone?: string | null;
  messengerUrl?: string | null;
  otherContact?: string | null;
  compact?: boolean;
}) {
  const cleanPhone = (phone ?? "").replace(/[^+\d]/g, "");
  const fbLink = normalizeMessengerUrl(messengerUrl);
  const other = (otherContact ?? "").trim();

  if (!cleanPhone && !fbLink && !other) {
    if (compact) return null;
    return (
      <View
        style={{
          backgroundColor: "#F8FAFC",
          borderColor: c.border,
          borderWidth: 1,
          borderRadius: 14,
          padding: 13,
          gap: 4,
        }}
      >
        <Text style={{ fontSize: 12, fontWeight: "700", color: c.navy }}>
          Operator Contact · {ownerName || "Boat Owner"}
        </Text>
        <Text style={styles.muted}>
          Direct operator contact details appear once set by the boat owner or upon booking confirmation.
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        backgroundColor: "#F8FAFC",
        borderColor: "#CBD5E1",
        borderWidth: 1,
        borderRadius: 14,
        padding: compact ? 11 : 14,
        gap: 9,
      }}
    >
      <View style={styles.between}>
        <Text style={{ fontSize: 13, fontWeight: "800", color: c.navy }}>
          👤 Contact Boat Owner: {ownerName || "Operator"}
        </Text>
      </View>

      <View style={{ gap: 4 }}>
        {!!cleanPhone && (
          <Text style={{ fontSize: 12, color: c.text, fontWeight: "600" }}>
            📞 Mobile / Call: {phone}
          </Text>
        )}
        {!!fbLink && (
          <Text style={{ fontSize: 12, color: "#006AFF", fontWeight: "600" }}>
            💬 Messenger: {messengerUrl}
          </Text>
        )}
        {!!other && (
          <Text style={{ fontSize: 12, color: c.muted, fontWeight: "600" }}>
            📱 Other contact: {other}
          </Text>
        )}
      </View>

      <View style={styles.row}>
        {!!fbLink && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Call or chat ${ownerName || "operator"} on Messenger`}
            onPress={() => void Linking.openURL(fbLink)}
            style={{
              backgroundColor: "#006AFF",
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <MessageCircle size={14} color="#FFFFFF" />
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#FFFFFF" }}>
              Call / Chat on Messenger
            </Text>
          </Pressable>
        )}
        {!!cleanPhone && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Call ${ownerName || "operator"}`}
            onPress={() => void Linking.openURL(`tel:${cleanPhone}`)}
            style={{
              backgroundColor: c.ocean,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Phone size={14} color="#FFFFFF" />
            <Text style={{ fontSize: 12, fontWeight: "700", color: "#FFFFFF" }}>
              Call {cleanPhone}
            </Text>
          </Pressable>
        )}
        {!!cleanPhone && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Send SMS to ${ownerName || "operator"}`}
            onPress={() => void Linking.openURL(`sms:${cleanPhone}`)}
            style={{
              backgroundColor: "#FFFFFF",
              borderColor: c.border,
              borderWidth: 1,
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <MessageSquare size={14} color={c.navy} />
            <Text style={{ fontSize: 12, fontWeight: "700", color: c.navy }}>
              SMS
            </Text>
          </Pressable>
        )}
        {!!other &&
          (other.startsWith("http://") ||
            other.startsWith("https://") ||
            other.startsWith("viber://") ||
            other.startsWith("whatsapp://")) && (
            <Pressable
              accessibilityRole="button"
              onPress={() => void Linking.openURL(other)}
              style={{
                backgroundColor: "#FFFFFF",
                borderColor: c.border,
                borderWidth: 1,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Share2 size={14} color={c.navy} />
              <Text style={{ fontSize: 12, fontWeight: "700", color: c.navy }}>
                Open Other Contact
              </Text>
            </Pressable>
          )}
      </View>
    </View>
  );
}

export function BookingContact({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const [contact, setContact] = useState<any | null>(null);
  const [error, setError] = useState("");

  return (
    <View style={{ gap: 8 }}>
      {!contact ? (
        <Button
          secondary
          title="Show operator / passenger contact & Messenger"
          busy={busy}
          onPress={async () => {
            setBusy(true);
            setError("");
            try {
              const rows = await backend.rpc("booking_contact", { p_id: id });
              const first = rows?.[0];
              if (!first) {
                throw new Error("Contact details are not yet available.");
              }
              setContact(first);
            } catch (e) {
              setError(
                e instanceof Error ? e.message : "Contact unavailable.",
              );
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : (
        <OperatorContactCard
          ownerName={contact.display_name}
          phone={contact.phone}
          messengerUrl={contact.messenger_url}
          otherContact={contact.other_contact}
        />
      )}
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}
