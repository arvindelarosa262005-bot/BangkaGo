import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect, router } from "expo-router";
import { Compass, Users, CalendarCheck, CreditCard } from "lucide-react-native";
import { HarborArt } from "../src/HarborArt";
import { Screen, Brand, Button, Badge, styles, c } from "../src/ui";
const slides = [
  {
    title: "Find your next shore.",
    body: "Discover approved boats and supported routes, starting in Abra de Ilog.",
    icon: Compass,
  },
  {
    title: "A boat for your journey.",
    body: "Choose a private charter or reserve seats on a shared trip.",
    icon: Users,
  },
  {
    title: "Make plans with confidence.",
    body: "See the complete fare, trip schedule, and cancellation policy before booking.",
    icon: CalendarCheck,
  },
  {
    title: "A simpler way to pay.",
    body: "Use provider-hosted checkout when GCash payments are configured.",
    icon: CreditCard,
  },
];
export default function Onboarding() {
  const [seen, setSeen] = useState<boolean | null>(null);
  const [step, setStep] = useState(0);
  useEffect(() => {
    AsyncStorage.getItem("onboarding").then((v) => setSeen(v === "done"));
  }, []);
  if (seen === null) return null;
  if (seen) return <Redirect href="/(tabs)" />;
  const slide = slides[step];
  const Icon = slide.icon;
  async function finish() {
    await AsyncStorage.setItem("onboarding", "done");
    router.replace("/(tabs)");
  }
  return (
    <Screen>
      <View style={styles.between}>
        <Brand />
        <Badge value={`Step ${step + 1} of ${slides.length}`} />
      </View>
      <View style={[styles.card, { padding: 0, overflow: "hidden", gap: 0 }]}>
        <View style={{ position: "relative" }}>
          <HarborArt height={165} />
          <View
            style={{
              position: "absolute",
              right: 20,
              bottom: -24,
              width: 56,
              height: 56,
              borderRadius: 18,
              backgroundColor: c.navy,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 3,
              borderColor: "#fff",
            }}
          >
            <Icon size={28} color="#92C7FF" />
          </View>
        </View>
        <View style={{ padding: 26, paddingTop: 32, gap: 18 }}>
          <Text style={{ ...styles.title, fontSize: 33 }}>{slide.title}</Text>
          <Text style={styles.subtitle}>{slide.body}</Text>
          <View style={styles.row}>
            {slides.map((_, i) => (
              <View
                key={i}
                style={{
                  width: i === step ? 28 : 8,
                  height: 8,
                  borderRadius: 5,
                  backgroundColor: i === step ? c.ocean : c.border,
                }}
              />
            ))}
          </View>
          <View style={styles.row}>
            {step > 0 && (
              <View style={{ flex: 1 }}>
                <Button
                  secondary
                  title="Previous"
                  onPress={() => setStep(step - 1)}
                />
              </View>
            )}
            <View style={{ flex: 2 }}>
              <Button
                title={step === 3 ? "Get started" : "Next"}
                onPress={() => (step === 3 ? finish() : setStep(step + 1))}
              />
            </View>
          </View>
          <Button secondary title="Skip introduction" onPress={finish} />
        </View>
      </View>
    </Screen>
  );
}
