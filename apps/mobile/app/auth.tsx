import {
  Eye,
  EyeOff,
  Mail,
  LockKeyhole,
  ShieldCheck,
  MapPin,
  ArrowLeft,
  Compass,
  Users,
  Ship,
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
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { authSchema } from "@bangkago/shared";
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
export default function Auth() {
  const params = useLocalSearchParams();
  const { width } = useWindowDimensions();
  const desktop = width >= 850;
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState(params.mode === "reset" ? "reset" : "login");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (configured && typeof params.code === "string" && params.code) {
      supabase.auth
        .exchangeCodeForSession(params.code)
        .then(({ error }) => {
          if (error) setMessage(error.message);
        });
    }
    const urlSub = Linking.addEventListener("url", ({ url }) => {
      if (!configured) return;
      try {
        const parsed = Linking.parse(url);
        const code = parsed.queryParams?.code;
        if (typeof code === "string" && code) {
          supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
            if (error) setMessage(error.message);
          });
        }
      } catch {
        /* ignore malformed URL */
      }
    });
    const { data } = supabase.auth.onAuthStateChange(async (e, session) => {
      if (e === "PASSWORD_RECOVERY") setMode("reset");
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
  const form = useForm({
    resolver: zodResolver(authSchema),
    defaultValues: {
      email: "",
      password: "",
      display_name: "Traveller",
      role: "passenger" as "passenger" | "owner",
    },
  });
  const [busy, setBusy] = useState(false);
  async function signInWithGoogle() {
    if (!configured) {
      setMessage(
        "BangkaGo is awaiting its Supabase connection. See the setup guide.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const chosenRole =
        (mode === "signup" ? form.getValues("role") : "passenger") ??
        "passenger";
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
      setMessage(
        e instanceof Error
          ? e.message
          : "Unable to sign in with Google. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    if (!configured) {
      setMessage(
        "BangkaGo is awaiting its Supabase connection. See the setup guide.",
      );
      return;
    }
    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(
          form.getValues("email"),
          {
            redirectTo: Linking.createURL("auth", {
              queryParams: { mode: "reset" },
            }),
          },
        );
        if (error) throw error;
        setMessage("Check your email for a password reset link.");
      } else if (mode === "reset") {
        const password = form.getValues("password");
        if (password.length < 10)
          throw new Error("Use at least 10 characters.");
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setMessage("Password updated.");
        router.replace("/(tabs)");
      } else {
        if (!(await form.trigger())) return;
        const v = form.getValues();
        if (mode === "signup") {
          if (!v.display_name || v.display_name.trim().length < 2)
            throw new Error("Enter your full name.");
          const { data, error } = await supabase.auth.signUp({
            email: v.email,
            password: v.password,
            options: {
              data: { display_name: v.display_name, role: v.role },
              emailRedirectTo: Linking.createURL("auth"),
            },
          });
          if (error) throw error;
          if (data.session) router.replace("/(tabs)");
          else
            setMessage(
              "Check your email to verify your account, then sign in.",
            );
        } else {
          const { error } = await supabase.auth.signInWithPassword({
            email: v.email,
            password: v.password,
          });
          if (error) throw error;
          router.replace("/(tabs)");
        }
      }
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Unable to authenticate. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  function switchMode(next: string) {
    setMode(next);
    setMessage("");
    form.setValue("display_name", next === "signup" ? "" : "Traveller");
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
            Local boats. New possibilities. Your next journey starts with
            BangkaGo.
          </Text>
          <View style={[auth.art, !desktop && { height: 130, marginTop: 14 }]}>
            <HarborArt height={desktop ? 245 : 150} />
          </View>
          {desktop && (
            <View style={{ gap: 18, marginTop: 22 }}>
              {[
                [
                  Compass,
                  "Find your shore",
                  "Discover approved boats and local routes.",
                ],
                [
                  Users,
                  "Travel your way",
                  "Reserve a seat or charter the whole boat.",
                ],
                [
                  ShieldCheck,
                  "Know before you go",
                  "See the fare, operator and trip details.",
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
            <Text style={auth.eyebrow}>YOUR JOURNEY, YOUR BOAT.</Text>
            <LiveIndicator />
          </View>
          <Text
            accessibilityRole="header"
            style={[styles.title, { fontSize: 30, marginTop: 8 }]}
          >
            {mode === "signup"
              ? "Start your journey"
              : mode === "forgot"
                ? "Forgot your password?"
                : mode === "reset"
                  ? "Choose a new password"
                  : "Welcome aboard."}
          </Text>
          <Text style={[styles.subtitle, { marginBottom: 10 }]}>
            {mode === "signup"
              ? "A few details, a world of new shores."
              : mode === "forgot"
                ? "We’ll send a secure link to your email address."
                : mode === "reset"
                  ? "Use a strong password to keep your account safe."
                  : "Sign in and pick up where your journey left off."}
          </Text>
          {["login", "signup"].includes(mode) && (
            <View style={auth.tabs}>
              {[
                ["login", "Sign in"],
                ["signup", "Create account"],
              ].map(([value, label]) => (
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
          )}
          {mode === "signup" && (
            <>
              <Text style={styles.label}>How will you use BangkaGo?</Text>
              <View style={auth.roles}>
                {(["passenger", "owner"] as const).map((role) => {
                  const selected = form.watch("role") === role;
                  const Icon = role === "owner" ? Ship : Users;
                  return (
                    <Pressable
                      key={role}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      aria-checked={selected}
                      onPress={() => form.setValue("role", role)}
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
                        {role === "owner" ? "Boat owner" : "Passenger"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Controller
                control={form.control}
                name="display_name"
                render={({ field }) => (
                  <Field
                    label="Full name"
                    placeholder="Your name"
                    autoComplete="name"
                    value={field.value}
                    onChangeText={field.onChange}
                    error={form.formState.errors.display_name?.message}
                  />
                )}
              />
            </>
          )}
          {mode !== "reset" && (
            <Controller
              control={form.control}
              name="email"
              render={({ field }) => (
                <Field
                  label="Email address"
                  placeholder="you@example.com"
                  icon={<Mail size={18} color="#8A9DB5" />}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  value={field.value}
                  onChangeText={field.onChange}
                  error={form.formState.errors.email?.message}
                />
              )}
            />
          )}
          {mode !== "forgot" && (
            <Controller
              control={form.control}
              name="password"
              render={({ field }) => (
                <Field
                  label="Password"
                  placeholder={
                    mode === "signup"
                      ? "At least 10 characters"
                      : "Enter your password"
                  }
                  icon={<LockKeyhole size={18} color="#8A9DB5" />}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete={
                    mode === "signup" ? "new-password" : "current-password"
                  }
                  value={field.value}
                  onChangeText={field.onChange}
                  error={form.formState.errors.password?.message}
                  accessory={
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        showPassword ? "Hide password" : "Show password"
                      }
                      onPress={() => setShowPassword(!showPassword)}
                      style={{ padding: 10 }}
                    >
                      {showPassword ? (
                        <EyeOff color={c.muted} size={18} />
                      ) : (
                        <Eye color={c.muted} size={18} />
                      )}
                    </Pressable>
                  }
                />
              )}
            />
          )}
          {mode === "login" && (
            <Pressable
              accessibilityRole="button"
              onPress={() => switchMode("forgot")}
              style={{ alignSelf: "flex-end", paddingVertical: 5 }}
            >
              <Text style={styles.link}>Forgot password</Text>
            </Pressable>
          )}
          {!!message && (
            <View accessibilityLiveRegion="polite" style={auth.message}>
              <Text style={{ fontSize: 13, lineHeight: 21, color: c.text }}>
                {message}
              </Text>
            </View>
          )}
          <Button
            title={
              mode === "signup"
                ? "Create account"
                : mode === "forgot"
                  ? "Send reset link"
                  : mode === "reset"
                    ? "Update password"
                    : "Sign in"
            }
            busy={busy}
            onPress={submit}
          />
          {["login", "signup"].includes(mode) && (
            <>
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
            </>
          )}
          {["forgot", "reset"].includes(mode) && (
            <Button
              secondary
              title="Back to sign in"
              onPress={() => switchMode("login")}
            />
          )}
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
              Your account. Your journeys. Your privacy.
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
  form: { padding: 25, gap: 16 },
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
  roles: { flexDirection: "row", gap: 10, marginTop: -10 },
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
