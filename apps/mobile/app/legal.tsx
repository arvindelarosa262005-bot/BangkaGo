import React from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { Screen, Button, styles } from "../src/ui";
export default function Legal() {
  return (
    <Screen>
      <Button secondary title="Back" onPress={() => router.back()} />
      <Text style={styles.title}>Terms & privacy</Text>
      <Text style={styles.muted}>
        Development policy · business and legal review required before public
        pilot
      </Text>
      <View style={styles.card}>
        <Text style={styles.h2}>Booking and safety</Text>
        <Text style={styles.subtitle}>
          A booking request temporarily reserves capacity and requires operator
          acceptance and verified payment. Operators may cancel for unsafe
          weather or operating conditions. Follow crew instructions and
          passenger limits. See each boat’s cancellation policy before
          confirming.
        </Text>
        <Text style={styles.h2}>Payments and refunds</Text>
        <Text style={styles.subtitle}>
          Checkout is handled by the configured payment provider. BangkaGo never
          asks for a GCash PIN or OTP. A redirect or screenshot does not confirm
          payment. Eligible refunds remain pending until confirmed by the
          provider. Operator payouts require a verified settlement record.
        </Text>
        <Text style={styles.h2}>Your information</Text>
        <Text style={styles.subtitle}>
          We use account details, bookings, contact information, and transaction
          references to arrange trips and provide support. Your contact number
          is shared only with the other party in an accepted booking and
          authorized administrators. Boat documents are private to their owner
          and authorized reviewers. Financial and audit records are retained for
          legitimate operational obligations.
        </Text>
        <Text style={styles.h2}>Your choices</Text>
        <Text style={styles.subtitle}>
          You can edit your profile and notification preferences in your
          account. Contact support to request access, correction, account
          closure, or review of retained data. The operating entity, privacy
          contact, retention periods, and final cancellation terms must be
          published before public launch.
        </Text>
      </View>
    </Screen>
  );
}
