import {
  Mail,
  KeyRound,
  ShieldCheck,
  MapPin,
  ArrowLeft,
  Compass,
  Users,
  Ship,
  CheckCircle2,
  RefreshCw,
} from "lucide-react-native";
import { HarborArt } from "../src/HarborArt";
import { LiveIndicator } from "../src/live";
import React, { useState, useEffect } from "react";
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Platform,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { backend, supabase, configured } from "../src/client";
import { Brand, Screen, Field, Button, styles, c } from "../src/ui";
import * as Linking from "expo-linking";

function GoogleLogo() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
      />
      <Path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
      />
      <Path
        fill="#FBBC05"
        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
      />
      <Path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
      />
    </Svg>
  );
}

function isValidGmail(email: string): boolean {
  return /^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(email.trim());
}

export default function Auth() {
  const params = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const desktop = width >= 850;

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"passenger" | "owner">("passenger");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (configured && typeof params.code === "string" && params.code) {
      supabase.auth
        .exchangeCodeForSession(params.code)
        .then(({ error }) => {
          if (error) {
            setIsError(true);
            setMessage(error.message);
          }
        });
    }
    const urlSub = Linking.addEventListener("url", ({ url }) => {
      if (!configured) return;
      try {
        const parsed = Linking.parse(url);
        const code = parsed.queryParams?.code;
        if (typeof code === "string" && code) {
          supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
            if (error) {
              setIsError(true);
              setMessage(error.message);
            }
          });
        }
      } catch {
        /* ignore malformed URL */
      }
    });
    const { data } = supabase.auth.onAuthStateChange(async (e, session) => {
      if (e === "SIGNED_IN" && session) {
        const pendingRole = await AsyncStorage.getItem("pending-oauth-role");
        if (pendingRole) {
          await AsyncStorage.removeItem("pending-oauth-role");
          if (pendingRole === "owner") {
            try {
              await backend.rpc("register_as_owner");
            } catch {
              /* profile may already be owner or admin */
            }
          }
        }
        router.replace("/(tabs)");
      }
    });
    return () => {
      urlSub.remove();
      data.subscription.unsubscribe();
    };
  }, [params.code]);

  function switchMode(next: "login" | "signup") {
    setMode(next);
    setOtpSent(false);
    setOtpCode("");
    setMessage("");
    setIsError(false);
  }

  async function requestGmailOtp() {
    if (!configured) {
      setIsError(true);
      setMessage(
        "BangkaGo is awaiting its Supabase connection. See the setup guide.",
      );
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!isValidGmail(cleanEmail)) {
      setIsError(true);
      setMessage(
        "Mangyaring ilagay ang iyong valid na @gmail.com email address.",
      );
      return;
    }

    if (mode === "signup" && displayName.trim().length < 2) {
      setIsError(true);
      setMessage("Ilagay muna ang iyong buong pangalan (Full name).");
      return;
    }

    setBusy(true);
    setIsError(false);
    setMessage("");

    try {
      // 1. Check Gmail registration status in database if RPC is available
      try {
        const { data: statusData, error: rpcErr } = await supabase.rpc(
          "check_gmail_status",
          { p_email: cleanEmail },
        );
        if (!rpcErr && statusData) {
          const isRegistered = Boolean((statusData as any).registered);
          const existsInAuth = Boolean((statusData as any).exists);
          if (mode === "login" && !existsInAuth) {
            setIsError(true);
            setMessage(
              `Hindi pa naka-register ang Gmail na ito (${cleanEmail}). Pumunta muna sa "Create account" tab para mag-Sign Up.`,
            );
            setBusy(false);
            return;
          }
          if (mode === "signup" && isRegistered) {
            setIsError(true);
            setMessage(
              `Naka-register na ang Gmail na ito (${cleanEmail}). Lumipat sa "Sign in" tab para humingi ng login OTP.`,
            );
            setBusy(false);
            return;
          }
        }
      } catch {
        // Fallback to Supabase Auth shouldCreateUser enforcement below
      }

      const redirectTo =
        Platform.OS === "web" && typeof window !== "undefined"
          ? `${window.location.origin}/auth`
          : Linking.createURL("auth");

      await AsyncStorage.setItem(
        "pending-oauth-role",
        mode === "signup" ? role : "passenger",
      );

      // 2. Request OTP from Supabase Auth
      // When mode === "login", shouldCreateUser: false strictly blocks unregistered Gmails!
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: mode === "signup",
          emailRedirectTo: redirectTo,
          data:
            mode === "signup"
              ? { display_name: displayName.trim(), role }
              : undefined,
        },
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (
          mode === "login" &&
          (msg.includes("signups not allowed") ||
            msg.includes("user not found") ||
            msg.includes("invalid") ||
            error.status === 400 ||
            error.status === 422)
        ) {
          throw new Error(
            `Hindi pa naka-register ang Gmail na ito (${cleanEmail}). Mag-register muna sa "Create account" (Sign Up) tab bago mag-sign in.`,
          );
        }
        throw error;
      }

      setOtpSent(true);
      setIsError(false);
      setMessage(
        `Naipadala na ang OTP sa iyong Gmail inbox (${cleanEmail}). Buksan ang iyong Gmail at ilagay ang 6-digit OTP code sa ibaba.`,
      );
    } catch (e) {
      setIsError(true);
      setMessage(
        e instanceof Error
          ? e.message
          : "Hindi maipadala ang OTP. Subukan ulit.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function verifyGmailOtp() {
    if (!configured) return;
    const cleanEmail = email.trim().toLowerCase();
    const rawInput = otpCode.trim();
    if (!rawInput) {
      setIsError(true);
      setMessage("Ilagay ang OTP code na galing sa iyong Gmail inbox.");
      return;
    }

    setBusy(true);
    setIsError(false);
    setMessage("");

    try {
      // Support pasting either the 6/8-digit OTP code OR a full confirmation URL from Gmail
      if (rawInput.startsWith("http://") || rawInput.startsWith("https://")) {
        const urlObj = new URL(rawInput);
        const tokenHash =
          urlObj.searchParams.get("token_hash") ||
          urlObj.searchParams.get("token");
        const codeParam = urlObj.searchParams.get("code");
        const hashParams = new URLSearchParams(urlObj.hash.replace(/^#/, ""));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          router.replace("/(tabs)");
          return;
        }
        if (codeParam) {
          const { error } =
            await supabase.auth.exchangeCodeForSession(codeParam);
          if (error) throw error;
          router.replace("/(tabs)");
          return;
        }
        if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "email",
          });
          if (error) throw error;
          router.replace("/(tabs)");
          return;
        }
      }

      // Standard 6-digit / 8-digit OTP token verification
      const token = rawInput.replace(/\s+/g, "");
      let lastError: Error | null = null;
      const typesToTry: Array<"email" | "signup" | "magiclink"> =
        mode === "signup"
          ? ["email", "signup", "magiclink"]
          : ["email", "magiclink", "signup"];

      for (const otpType of typesToTry) {
        const { data, error } = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token,
          type: otpType,
        });
        if (!error && data.session) {
          if (mode === "signup" && role === "owner") {
            try {
              await backend.rpc("register_as_owner");
            } catch {
              /* profile already owner */
            }
          }
          router.replace("/(tabs)");
          return;
        }
        if (error) lastError = error;
      }

      throw (
        lastError ??
        new Error("Invalid o expired na ang OTP code. Humingi ng bagong OTP.")
      );
    } catch (e) {
      setIsError(true);
      setMessage(
        e instanceof Error
          ? e.message
          : "Invalid o expired na ang OTP code. Subukan ulit.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function signInWithGoogle() {
    if (!configured) {
      setIsError(true);
      setMessage(
        "BangkaGo is awaiting its Supabase connection. See the setup guide.",
      );
      return;
    }
    setBusy(true);
    setIsError(false);
    setMessage("");
    try {
      const chosenRole = mode === "signup" ? role : "passenger";
      await AsyncStorage.setItem("pending-oauth-role", chosenRole);
      const redirectTo =
        Platform.OS === "web" && typeof window !== "undefined"
          ? `${window.location.origin}/auth`
          : Linking.createURL("auth");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          skipBrowserRedirect: Platform.OS !== "web",
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });
      if (error) throw error;
      if (Platform.OS !== "web" && data?.url) {
        await Linking.openURL(data.url);
      }
    } catch (e) {
      setIsError(true);
      setMessage(
        e instanceof Error
          ? e.message
          : "Unable to sign in with Google. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      wide
      hideLive
      contentStyle={{ paddingTop: desktop ? 38 : 18, gap: 20 }}
    >
      <View style={styles.between}>
        <Brand />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to explore"
          onPress={() => router.replace("/(tabs)")}
          style={auth.back}
        >
          <ArrowLeft size={16} color={c.muted} />
          {desktop && <Text style={styles.muted}>Back to explore</Text>}
        </Pressable>
      </View>
      <View style={[auth.shell, desktop && auth.shellWide]}>
        <View style={[auth.story, desktop ? { flex: 1 } : { padding: 24 }]}>
          <View style={auth.location}>
            <MapPin size={13} color="#B9D9FF" />
            <Text style={auth.locationText}>ABRA DE ILOG · PHILIPPINES</Text>
          </View>
          <Text
            style={[
              auth.storyTitle,
              !desktop && { fontSize: 28, lineHeight: 35 },
            ]}
          >
            More than a crossing.{"\n"}A connection.
          </Text>
          <Text style={auth.storyBody}>
            Verified Gmail OTP sign-in. Real local boat operators. GIS-guided
            port boarding points.
          </Text>
          <View style={[auth.art, !desktop && { height: 130, marginTop: 14 }]}>
            <HarborArt height={desktop ? 245 : 150} />
          </View>
          {desktop && (
            <View style={{ gap: 18, marginTop: 22 }}>
              {[
                [
                  Compass,
                  "GIS Port & Pickup Pins",
                  "See exact GPS coordinates and pickup landmarks.",
                ],
                [
                  Users,
                  "Real Registered Operators",
                  "Book seats or private charters from verified local owners.",
                ],
                [
                  ShieldCheck,
                  "Gmail OTP Security",
                  "Only registered Gmail accounts can sign in via inbox OTP.",
                ],
              ].map(([Icon, title, body]) => {
                const Symbol = Icon as typeof Compass;
                return (
                  <View
                    key={String(title)}
                    style={{
                      flexDirection: "row",
                      gap: 13,
                      alignItems: "center",
                    }}
                  >
                    <View style={auth.featureIcon}>
                      <Symbol size={18} color="#BFDFFF" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={auth.featureTitle}>{title as string}</Text>
                      <Text style={auth.featureBody}>{body as string}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
        <View style={[auth.form, desktop && { flex: 1, padding: 42 }]}>
          <View style={styles.between}>
            <Text style={auth.eyebrow}>GMAIL OTP AUTHENTICATION</Text>
            <LiveIndicator />
          </View>
          <Text
            accessibilityRole="header"
            style={[styles.title, { fontSize: 30, marginTop: 8 }]}
          >
            {mode === "signup" ? "Start your journey" : "Welcome aboard."}
          </Text>
          <Text style={[styles.subtitle, { marginBottom: 6 }]}>
            {mode === "signup"
              ? "I-register ang iyong Gmail at kunin ang OTP code sa iyong Gmail inbox."
              : "Mag-sign in gamit ang OTP code na ipapadala sa iyong rehistradong Gmail inbox."}
          </Text>

          <View style={auth.tabs}>
            {(
              [
                ["login", "Sign in"],
                ["signup", "Create account"],
              ] as const
            ).map(([value, label]) => (
              <Pressable
                key={value}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === value }}
                aria-selected={mode === value}
                onPress={() => switchMode(value)}
                style={[auth.tab, mode === value && auth.activeTab]}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "600",
                    color: mode === value ? c.navy : c.muted,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          {mode === "signup" && !otpSent && (
            <>
              <Text style={styles.label}>How will you use BangkaGo?</Text>
              <View style={auth.roles}>
                {(["passenger", "owner"] as const).map((r) => {
                  const selected = role === r;
                  const Icon = r === "owner" ? Ship : Users;
                  return (
                    <Pressable
                      key={r}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      aria-checked={selected}
                      onPress={() => setRole(r)}
                      style={[
                        auth.role,
                        selected && {
                          borderColor: c.ocean,
                          backgroundColor: c.ice,
                        },
                      ]}
                    >
                      <Icon size={20} color={selected ? c.ocean : c.muted} />
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "600",
                          color: selected ? c.navy : c.muted,
                        }}
                      >
                        {r === "owner" ? "Boat owner" : "Passenger"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Field
                label="Full name"
                placeholder="Juan Dela Cruz"
                autoComplete="name"
                value={displayName}
                onChangeText={setDisplayName}
              />
            </>
          )}

          <Field
            label="Gmail address"
            placeholder="pangalan@gmail.com"
            icon={<Mail size={18} color="#8A9DB5" />}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (otpSent) setOtpSent(false);
            }}
          />

          {otpSent && (
            <View style={auth.otpBox}>
              <View style={styles.row}>
                <CheckCircle2 size={16} color={c.success} />
                <Text
                  style={{ fontSize: 12, fontWeight: "700", color: c.navy }}
                >
                  Buksan ang iyong Gmail Inbox ({email.trim()})
                </Text>
              </View>
              <Field
                label="6-Digit OTP Code from Gmail Inbox"
                placeholder="Halimbawa: 123456"
                icon={<KeyRound size={18} color={c.ocean} />}
                keyboardType="default"
                autoCapitalize="none"
                value={otpCode}
                onChangeText={setOtpCode}
              />
              <Button
                title={
                  mode === "signup"
                    ? "Verify OTP & Complete Sign Up"
                    : "Verify OTP & Sign in"
                }
                busy={busy}
                onPress={verifyGmailOtp}
              />
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={requestGmailOtp}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  paddingVertical: 6,
                }}
              >
                <RefreshCw size={13} color={c.ocean} />
                <Text style={styles.link}>Resend OTP to Gmail</Text>
              </Pressable>
            </View>
          )}

          {!!message && (
            <View
              accessibilityLiveRegion="polite"
              style={[
                auth.message,
                isError && {
                  backgroundColor: "#FEF2F2",
                  borderColor: "#FECACA",
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 13,
                  lineHeight: 20,
                  color: isError ? c.error : c.navy,
                  fontWeight: isError ? "600" : "500",
                }}
              >
                {message}
              </Text>
            </View>
          )}

          {!otpSent && (
            <Button
              title={
                mode === "signup"
                  ? "Send Signup OTP to Gmail"
                  : "Sign in"
              }
              busy={busy}
              onPress={requestGmailOtp}
            />
          )}

          <View style={auth.divider}>
            <View style={auth.line} />
            <Text style={auth.dividerText}>or continue with</Text>
            <View style={auth.line} />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
            disabled={busy}
            onPress={signInWithGoogle}
            style={({ pressed }) => [
              auth.googleBtn,
              pressed && { backgroundColor: "#F8FAFC" },
              busy && { opacity: 0.6 },
            ]}
          >
            <GoogleLogo />
            <Text style={auth.googleBtnText}>
              {mode === "signup"
                ? "Sign up with Google"
                : "Sign in with Google"}
            </Text>
          </Pressable>

          <View style={auth.divider}>
            <View style={auth.line} />
            <Text style={auth.dividerText}>the water is waiting</Text>
            <View style={auth.line} />
          </View>
          <Button
            secondary
            title="Explore boats"
            onPress={() => router.replace("/(tabs)")}
          />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              marginTop: 4,
            }}
          >
            <ShieldCheck size={14} color="#8397B0" />
            <Text style={{ fontSize: 10, color: c.muted }}>
              Hindi makakapag-Sign In ang Gmail na hindi pa rehistrado.
            </Text>
          </View>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Terms and privacy"
            onPress={() => router.push("/legal")}
            style={{ alignSelf: "center", padding: 8 }}
          >
            <Text
              style={{
                fontSize: 11,
                color: c.muted,
                textDecorationLine: "underline",
              }}
            >
              Terms & privacy
            </Text>
          </Pressable>
        </View>
      </View>
      <Text
        style={{
          fontSize: 10,
          color: "#91A0B5",
          textAlign: "center",
          marginBottom: 8,
        }}
      >
        Made for journeys between Philippine shores.
      </Text>
    </Screen>
  );
}

const auth = StyleSheet.create({
  shell: {
    borderRadius: 26,
    overflow: "hidden",
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: c.border,
  },
  shellWide: { flexDirection: "row", alignItems: "stretch" },
  story: { backgroundColor: c.navy, padding: 36, overflow: "hidden" },
  location: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    marginBottom: 22,
  },
  locationText: {
    fontSize: 9,
    letterSpacing: 1.7,
    color: "#B9D9FF",
    fontWeight: "600",
  },
  storyTitle: {
    fontSize: 37,
    fontWeight: "700",
    lineHeight: 45,
    letterSpacing: -1.2,
    color: "white",
  },
  storyBody: {
    fontSize: 13,
    lineHeight: 23,
    color: "#BED1E9",
    maxWidth: 330,
    marginTop: 14,
  },
  art: {
    height: 230,
    borderRadius: 18,
    overflow: "hidden",
    marginTop: 28,
    backgroundColor: "#EAF3FF",
  },
  featureIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#214571",
    alignItems: "center",
    justifyContent: "center",
  },
  featureTitle: {
    fontSize: 12,
    color: "white",
    fontWeight: "600",
    marginBottom: 3,
  },
  featureBody: { fontSize: 11, color: "#B9CCE4", lineHeight: 18 },
  form: { padding: 25, gap: 15 },
  eyebrow: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.2,
    color: c.ocean,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: "#F0F5FB",
    padding: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  tab: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  activeTab: {
    backgroundColor: "white",
    borderWidth: 1,
    borderColor: c.border,
  },
  roles: { flexDirection: "row", gap: 10, marginTop: -6 },
  role: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  otpBox: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    gap: 12,
  },
  back: { flexDirection: "row", alignItems: "center", gap: 7, padding: 10 },
  message: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: c.ice,
    borderWidth: 1,
    borderColor: "#D7E7FC",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginVertical: 1,
  },
  dividerText: { fontSize: 10, color: "#8C9CB0" },
  line: { height: 1, backgroundColor: c.border, flex: 1 },
  googleBtn: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 16,
    shadowColor: c.navy,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  googleBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: c.navy,
  },
});
