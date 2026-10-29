import { useState } from "react";
import { Linking, Text, View } from "react-native";
import { backend } from "./client";
import { Button, styles } from "./ui";
export function BookingContact({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <View style={{ gap: 8 }}>
      <Button
        secondary
        title="Call passenger"
        busy={busy}
        onPress={async () => {
          setBusy(true);
          setError("");
          try {
            const rows = await backend.rpc("booking_contact", { p_id: id });
            const phone = String(rows?.[0]?.phone ?? "").replace(/[^+\d]/g, "");
            if (!phone)
              throw new Error(
                "No passenger contact number is available. Contact booking support.",
              );
            await Linking.openURL("tel:" + phone);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Contact unavailable.");
          } finally {
            setBusy(false);
          }
        }}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}
