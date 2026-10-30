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
  Lock,
  Eye,
  EyeOff,
  Sparkles,
} from "lucide-react-native";
import { HarborArt } from "../src/HarborArt";
import { LiveIndicator } from "../src/live";
import React, { useState, useEffect, useRef } from "react";
import {
  Text,
  View,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  Platform,
  AppState,
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

function parseQueryAndHash(rawUrl: string): Record<string, string> {
  const out: Record<string, string> = {};
  const qIndex = rawUrl.indexOf("?");
  const hIndex = rawUrl.indexOf("#");
  if (qIndex !== -1) {
    const qPart =
      hIndex !== -1 && hIndex > qIndex
        ? rawUrl.slice(qIndex + 1, hIndex)
        : rawUrl.slice(qIndex + 1);
    const sp = new URLSearchParams(qPart);
    sp.forEach((v, k) => {
      out[k] = v;
    });
  }
  if (hIndex !== -1) {
    const hPart = rawUrl.slice(hIndex + 1);
    const hp = new URLSearchParams(hPart);
    hp.forEach((v, k) => {
      out[k] = v;
    });
  }
  return out;
}

export default function Auth() {
  const params = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const desktop = width >= 850;

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [method, setMethod] = useState<"password" | "otp">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"passenger" | "owner">("passenger");

  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);
  const handledUrlRef = useRef<string>("");

  const expoRedirectUrl =
    Platform.OS === "web" && typeof window !== "undefined"
      ? `${window.location.origin}/auth`
      : Linking.createURL("auth");

  async function finalizeRoleAndRedirect() {
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

  async function consumeAuthUrl(rawUrl?: string | null) {
    if (!configured || !rawUrl || handledUrlRef.current === rawUrl) return;
    if (
      !rawUrl.includes("code=") &&
      !rawUrl.includes("access_token=") &&
      !rawUrl.includes("token_hash=") &&
      !rawUrl.includes("error_description=")
    ) {
      return;
    }
    handledUrlRef.current = rawUrl;
    const kv = parseQueryAndHash(rawUrl);

    if (kv.error_description || kv.error) {
      setIsError(true);
      setMessage(
        decodeURIComponent(
          (kv.error_description || kv.error).replace(/\+/g, " "),
        ),
      );
      setBusy(false);
      return;
    }

    setBusy(true);
    setIsError(false);
    setMessage("Tinatanggap ang session…");
    try {
      if (kv.access_token && kv.refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token: kv.access_token,
          refresh_token: kv.refresh_token,
        });
        if (error) throw error;
        await finalizeRoleAndRedirect();
        return;
      }
      if (kv.code) {
        const { error } = await supabase.auth.exchangeCodeForSession(kv.code);
        if (error) throw error;
        await finalizeRoleAndRedirect();
        return;
      }
      if (kv.token_hash) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: kv.token_hash,
          type: (kv.type as any) || "email",
        });
        if (error) throw error;
        await finalizeRoleAndRedirect();
        return;
      }
    } catch (e) {
      setIsError(true);
      setMessage(
        e instanceof Error
          ? e.message
          : "Hindi ma-verify ang session. Gamitin ang password o Gmail OTP.",
      );
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (configured && typeof params.code === "string" && params.code) {
      void consumeAuthUrl(`?code=${params.code}`);
    }

    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl) void consumeAuthUrl(initialUrl);
    });

    const urlSub = Linking.addEventListener("url", ({ url }) => {
      void consumeAuthUrl(url);
    });

    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && configured) {
        Linking.getInitialURL().then((u) => {
          if (u) void consumeAuthUrl(u);
        });
        supabase.auth.getSession().then(({ data }) => {
          if (data.session) void finalizeRoleAndRedirect();
        });
      }
    });

    const { data } = supabase.auth.onAuthStateChange((e, session) => {
      if (e === "SIGNED_IN" && session) {
        setTimeout(() => {
          void finalizeRoleAndRedirect();
        }, 0);
      }
    });

    return () => {
      urlSub.remove();
      appStateSub.remove();
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

  // --- 1. DIRECT GMAIL + PASSWORD / PIN AUTHENTICATION (0 REDIRECT URLs NEEDED!) ---
  async function handlePasswordAuth() {
    if (!configured) {
      setIsError(true);
      setMessage("BangkaGo is connecting to Supabase...");
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!isValidGmail(cleanEmail)) {
      setIsError(true);
      setMessage("Pakilagay ang iyong valid na @gmail.com email address.");
      return;
    }

    if (!password || password.trim().length < 6) {
      setIsError(true);
      setMessage("Ang password o PIN code ay dapat hindi bababa sa 6 characters.");
      return;
    }

    if (mode === "signup" && displayName.trim().length < 2) {
      setIsError(true);
      setMessage("Ilagay ang iyong buong pangalan (Full Name).");
      return;
    }

    setBusy(true);
    setIsError(false);
    setMessage("");

    try {
      // Check registration status in Supabase Database
      let isRegistered = false;
      let existsInAuth = false;
      try {
        const { data: statusData, error: rpcErr } = await supabase.rpc(
          "check_gmail_status",
          { p_email: cleanEmail },
        );
        if (!rpcErr && statusData) {
          isRegistered = Boolean((statusData as any).registered);
          existsInAuth = Boolean((statusData as any).exists);
        }
      } catch {
        /* proceed to auth attempt */
      }

      if (mode === "login") {
        // ENFORCE: Unregistered Gmail CANNOT sign in!
        if (!existsInAuth && !isRegistered) {
          setIsError(true);
          setMessage(
            `❌ Hindi pa rehistrado ang Gmail na ito (${cleanEmail}). Mangyaring lumipat sa "Create account" tab sa itaas para mag-Sign Up bago mag-sign in.`,
          );
          setBusy(false);
          return;
        }

        // Direct Sign-In (zero redirect URLs, zero browser popups!)
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: password.trim(),
        });

        if (error) {
          const msg = error.message.toLowerCase();
          if (
            msg.includes("invalid login credentials") ||
            msg.includes("invalid grant")
          ) {
            throw new Error(
              "Maling password o PIN code. Pakisuri at subukan ulit, o gamitin ang Gmail OTP sa ibaba kung nakalimutan.",
            );
          }
          if (msg.includes("email not confirmed")) {
            throw new Error(
              "Kailangan kumpirmahin ang email. Gamitin ang 'Mag-sign in gamit ang Gmail OTP' sa ibaba.",
            );
          }
          throw error;
        }

        if (data.session) {
          await finalizeRoleAndRedirect();
          return;
        }
      } else {
        // Sign-Up mode
        if (existsInAuth && isRegistered) {
          setIsError(true);
          setMessage(
            `Naka-register na ang Gmail na ito (${cleanEmail}). Lumipat sa "Sign in" tab para mag-login gamit ang iyong password o OTP.`,
          );
          setBusy(false);
          return;
        }

        await AsyncStorage.setItem("pending-oauth-role", role);

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: password.trim(),
          options: {
            data: {
              display_name: displayName.trim(),
              role,
            },
          },
        });

        if (error) {
          throw error;
        }

        if (role === "owner") {
          try {
            await backend.rpc("register_as_owner");
          } catch {
            /* profile trigger handled it */
          }
        }

        if (data.session) {
          await finalizeRoleAndRedirect();
          return;
        }

        // If auto-confirm isn't active on server yet, switch to OTP to enter code
        setOtpSent(true);
        setMethod("otp");
        setMessage(
          `Nalikha na ang iyong account! Naipadala ang verification code sa iyong Gmail (${cleanEmail}). Ilagay ang code sa ibaba para pumasok agad.`,
        );
      }
    } catch (e) {
      setIsError(true);
      setMessage(
        e instanceof Error
          ? e.message
          : "Hindi makapasok. Pakisuri ang impormasyon at subukan muli.",
      );
    } finally {
      setBusy(false);
    }
  }

  // --- 2. OPTIONAL GMAIL OTP CODE FLOW (IN-APP 6-DIGIT CODE, ZERO URLs NEEDED!) ---
  async function requestGmailOtp() {
    if (!configured) {
      setIsError(true);
      setMessage("BangkaGo is connecting to Supabase...");
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    if (!isValidGmail(cleanEmail)) {
      setIsError(true);
      setMessage("Pakilagay ang iyong valid na @gmail.com email address.");
      return;
    }

    if (mode === "signup" && displayName.trim().length < 2) {
      setIsError(true);
      setMessage("Ilagay ang iyong buong pangalan (Full Name).");
      return;
    }

    setBusy(true);
    setIsError(false);
    setMessage("");

    try {
      // 1. Strict database check: cannot sign in if unregistered
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
              `❌ Hindi pa rehistrado ang Gmail na ito (${cleanEmail}). Mangyaring lumipat sa "Create account" tab para mag-Sign Up bago mag-sign in.`,
            );
            setBusy(false);
            return;
          }
          if (mode === "signup" && isRegistered) {
            setIsError(true);
            setMessage(
              `Naka-register na ang Gmail na ito (${cleanEmail}). Lumipat sa "Sign in" tab para mag-login.`,
            );
            setBusy(false);
            return;
          }
        }
      } catch {
        /* proceed to Supabase Auth check */
      }

      await AsyncStorage.setItem(
        "pending-oauth-role",
        mode === "signup" ? role : "passenger",
      );

      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: mode === "signup",
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
            `❌ Hindi pa rehistrado ang Gmail na ito (${cleanEmail}). Mag-register muna sa "Create account" tab bago mag-sign in.`,
          );
        }
        throw error;
      }

      setOtpSent(true);
      setIsError(false);
      setMessage(
        `✉️ Naipadala na ang 6-digit OTP sa iyong Gmail (${cleanEmail}). Buksan ang iyong Gmail inbox at i-type ang code sa ibaba.`,
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
      setMessage("Ilagay ang 6-digit OTP code mula sa iyong Gmail inbox.");
      return;
    }

    if (
      rawInput.includes("code=") ||
      rawInput.includes("access_token=") ||
      rawInput.includes("token_hash=")
    ) {
      await consumeAuthUrl(rawInput);
      return;
    }

    setBusy(true);
    setIsError(false);
    setMessage("");

    try {
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
        new Error("Invalid o expired na ang OTP code. Pakisuri at subukan muli.")
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

  // --- 3. GOOGLE SIGN-IN (ALTERNATIVE) ---
  async function signInWithGoogle() {
    if (!configured) {
      setIsError(true);
      setMessage("BangkaGo is connecting to Supabase...");
      return;
    }
    setBusy(true);
    setIsError(false);
    setMessage("");
    try {
      const chosenRole = mode === "signup" ? role : "passenger";
      await AsyncStorage.setItem("pending-oauth-role", chosenRole);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: expoRedirectUrl,
          skipBrowserRedirect: Platform.OS !== "web",
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });
      if (error) throw error;
      if (Platform.OS !== "web" && data?.url) {
        setMethod("otp");
        setOtpSent(true);
        setMessage(
          `Binubuksan ang Google account selector sa browser... Kung hindi kusang bumalik, gamitin ang Direct Gmail sign-in o ilagay ang OTP code.`,
        );
        await Linking.openURL(data.url);
      }
    } catch (e) {
      setIsError(true);
      setMessage(
        e instanceof Error
          ? e.message
          : "Hindi makapag-sign in gamit ang Google. Gamitin ang Direct Gmail Sign-in sa itaas.",
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
              !desktop && { fontSize: 26, lineHeight: 33 },
            ]}
          >
            More than a crossing.{"\n"}A connection.
          </Text>
          <Text style={auth.storyBody}>
            Direct Gmail authentication. Real registered local boat operators.
            Accurate GPS boarding locations.
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
                  "Zero Redirect In-App Login",
                  "Fast and secure sign-in directly inside the app without browser delays.",
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
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Sparkles size={14} color={c.ocean} />
              <Text style={auth.eyebrow}>BANGKAGO INSTANT AUTH</Text>
            </View>
            <LiveIndicator />
          </View>

          <Text
            accessibilityRole="header"
            style={[styles.title, { fontSize: 28, marginTop: 4 }]}
          >
            {mode === "signup" ? "Start your journey" : "Welcome aboard."}
          </Text>
          <Text style={[styles.subtitle, { marginBottom: 6, fontSize: 13 }]}>
            {mode === "signup"
              ? "Lumikha ng account gamit ang iyong @gmail.com at password o 6-digit PIN para makapasok agad nang walang redirect delays."
              : "Mag-sign in gamit ang iyong rehistradong Gmail. Hindi papayagan ng system ang hindi pa rehistradong account."}
          </Text>

          {/* Mode Switch Tabs (Sign in / Create account) */}
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
                    fontWeight: "700",
                    color: mode === value ? c.navy : c.muted,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Role Selection (Passenger vs Boat Owner) */}
          {mode === "signup" && !otpSent && (
            <>
              <Text style={[styles.label, { marginBottom: 6 }]}>
                Piliin ang iyong gampanin sa BangkaGo:
              </Text>
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
                      <Icon size={19} color={selected ? c.ocean : c.muted} />
                      <Text
                        style={{
                          fontSize: 12.5,
                          fontWeight: "700",
                          color: selected ? c.navy : c.muted,
                        }}
                      >
                        {r === "owner" ? "Boat Owner" : "Passenger"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Field
                label="Buong Pangalan (Full Name)"
                placeholder="Hal. Juan Dela Cruz"
                autoComplete="name"
                value={displayName}
                onChangeText={setDisplayName}
              />
            </>
          )}

          {/* Gmail Address Field */}
          <Field
            label="Gmail Address"
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

          {/* --- METHOD 1: PASSWORD / 6-DIGIT PIN (RECOMMENDED ZERO REDIRECT METHOD) --- */}
          {method === "password" && !otpSent && (
            <>
              <Field
                label={
                  mode === "signup"
                    ? "Gumawa ng Password o 6-Digit PIN"
                    : "Password o PIN Code"
                }
                placeholder={
                  mode === "signup"
                    ? "Min. 6 characters (hal. 123456 o secret)"
                    : "Ilagay ang iyong password o PIN"
                }
                icon={<Lock size={18} color="#8A9DB5" />}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
                accessory={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      showPassword ? "Hide password" : "Show password"
                    }
                    onPress={() => setShowPassword(!showPassword)}
                    style={{ padding: 8 }}
                  >
                    {showPassword ? (
                      <EyeOff size={18} color="#8A9DB5" />
                    ) : (
                      <Eye size={18} color="#8A9DB5" />
                    )}
                  </Pressable>
                }
              />

              <Button
                title={
                  mode === "signup"
                    ? "Create Account & Sign In"
                    : "Sign In"
                }
                busy={busy}
                onPress={handlePasswordAuth}
              />

              {/* Alternative to switch to OTP */}
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setMethod("otp");
                  setMessage("");
                  setIsError(false);
                }}
                style={auth.methodToggle}
              >
                <KeyRound size={14} color={c.ocean} />
                <Text style={styles.link}>
                  {mode === "login"
                    ? "Nakalimutan ang password? Mag-sign in gamit ang 6-digit Gmail OTP"
                    : "Gusto mo ba ng 6-digit verification code sa Gmail inbox?"}
                </Text>
              </Pressable>
            </>
          )}

          {/* --- METHOD 2: 6-DIGIT OTP IN-APP CODE --- */}
          {method === "otp" && (
            <>
              {!otpSent ? (
                <>
                  <Button
                    title={
                      mode === "signup"
                        ? "Ipadala ang Sign Up OTP sa Gmail"
                        : "Ipadala ang Login OTP sa Gmail"
                    }
                    busy={busy}
                    onPress={requestGmailOtp}
                  />
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setMethod("password");
                      setMessage("");
                      setIsError(false);
                    }}
                    style={auth.methodToggle}
                  >
                    <Lock size={14} color={c.ocean} />
                    <Text style={styles.link}>
                      Gamitin ang Password o PIN sa halip
                    </Text>
                  </Pressable>
                </>
              ) : (
                <View style={auth.otpBox}>
                  <View style={styles.row}>
                    <CheckCircle2 size={16} color={c.success} />
                    <Text
                      style={{ fontSize: 12.5, fontWeight: "700", color: c.navy }}
                    >
                      Ilagay ang 6-Digit Code mula sa Gmail
                    </Text>
                  </View>
                  <Field
                    label="6-Digit OTP Code (o i-paste ang login token)"
                    placeholder="Hal. 123456"
                    icon={<KeyRound size={18} color={c.ocean} />}
                    keyboardType="number-pad"
                    autoCapitalize="none"
                    value={otpCode}
                    onChangeText={setOtpCode}
                  />
                  <Button
                    title="I-verify ang OTP at Pumasok"
                    busy={busy}
                    onPress={verifyGmailOtp}
                  />
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: 4,
                    }}
                  >
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={requestGmailOtp}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        paddingVertical: 6,
                      }}
                    >
                      <RefreshCw size={13} color={c.ocean} />
                      <Text style={styles.link}>Resend OTP</Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setMethod("password");
                        setOtpSent(false);
                      }}
                      style={{ paddingVertical: 6 }}
                    >
                      <Text style={styles.link}>Bumalik sa Password</Text>
                    </Pressable>
                  </View>
                </View>
              )}
            </>
          )}

          {/* Feedback/Error Banner */}
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

          {/* Divider */}
          <View style={auth.divider}>
            <View style={auth.line} />
            <Text style={auth.dividerText}>o iba pang paraan</Text>
            <View style={auth.line} />
          </View>

          {/* Google OAuth (Secondary / Optional) */}
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

          {/* Helpful notice */}
          <View
            style={{
              backgroundColor: "#F8FAFC",
              borderRadius: 12,
              padding: 11,
              borderWidth: 1,
              borderColor: c.border,
              gap: 4,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <ShieldCheck size={14} color={c.ocean} />
              <Text style={{ fontSize: 11, fontWeight: "700", color: c.navy }}>
                Bakit Direct Gmail + Password / OTP ang inirerekomenda?
              </Text>
            </View>
            <Text style={{ fontSize: 11, color: c.muted, lineHeight: 16 }}>
              Hindi ito nangangailangan ng anumang Redirect URL sa Supabase at
              hindi lumalabas sa external browser, kaya 100% garantisadong
              walang loading delay o redirect error.
            </Text>
          </View>

          <View style={auth.divider}>
            <View style={auth.line} />
            <Text style={auth.dividerText}>the water is waiting</Text>
            <View style={auth.line} />
          </View>

          <Button
            secondary
            title="Explore boats without signing in"
            onPress={() => router.replace("/(tabs)")}
          />

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              marginTop: 2,
            }}
          >
            <ShieldCheck size={14} color="#8397B0" />
            <Text style={{ fontSize: 10.5, color: c.muted }}>
              Protektado: Hindi makakapag-login ang hindi pa rehistradong Gmail.
            </Text>
          </View>

          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Terms and privacy"
            onPress={() => router.push("/legal")}
            style={{ alignSelf: "center", padding: 6 }}
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
    fontSize: 10,
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
  methodToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 6,
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
    minHeight: 48,
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
    fontSize: 13.5,
    fontWeight: "600",
    color: c.navy,
  },
});
