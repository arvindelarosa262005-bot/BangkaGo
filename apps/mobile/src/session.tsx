import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import type { Role } from "@bangkago/shared";
import { supabase, configured } from "./client";

type ProfileData = {
  id: string;
  display_name: string;
  role: Role;
  phone: string | null;
  notifications_enabled: boolean;
  account_status?: string;
};

const Context = createContext<{
  session: Session | null;
  profile: ProfileData | null;
  loading: boolean;
  error: Error | null;
}>({ session: null, profile: null, loading: true, error: null });

function fallbackProfileFromSession(s: Session | null): ProfileData | null {
  if (!s?.user) return null;
  const meta = s.user.user_metadata ?? {};
  const rawName =
    meta.display_name ||
    meta.full_name ||
    meta.name ||
    (s.user.email ? s.user.email.split("@")[0] : "Traveller");
  const role: Role = meta.role === "owner" ? "owner" : "passenger";
  return {
    id: s.user.id,
    display_name: String(rawName).slice(0, 80),
    role,
    phone: s.user.phone || null,
    notifications_enabled: true,
    account_status: "active",
  };
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(configured);
  const qc = useQueryClient();
  const currentUser = useRef<string | null>(null);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const timer = setTimeout(() => {
      setLoading(false);
    }, 4000);

    supabase.auth
      .getSession()
      .then(({ data }) => {
        clearTimeout(timer);
        currentUser.current = data.session?.user.id ?? null;
        setSession(data.session);
        setLoading(false);
      })
      .catch(() => {
        clearTimeout(timer);
        setLoading(false);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      // Defer state updates out of Supabase's internal _acquireLock callback
      setTimeout(() => {
        const next = s?.user.id ?? null;
        if (currentUser.current !== next) {
          qc.clear();
          currentUser.current = next;
        }
        setSession(s);
        setLoading(false);
      }, 0);
    });

    return () => {
      clearTimeout(timer);
      data.subscription.unsubscribe();
    };
  }, [qc]);

  const profile = useQuery({
    queryKey: ["profile", session?.user.id],
    enabled: !!session,
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session!.user.id)
        .maybeSingle();
      if (error) {
        return fallbackProfileFromSession(session);
      }
      if (!data) {
        return fallbackProfileFromSession(session);
      }
      if (data.account_status && data.account_status !== "active") {
        throw new Error("Your account is restricted. Please contact support.");
      }
      return data as ProfileData;
    },
  });

  const resolvedProfile = profile.error
    ? null
    : (profile.data ?? fallbackProfileFromSession(session));

  return (
    <Context.Provider
      value={{
        session,
        profile: resolvedProfile,
        loading,
        error: profile.error,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export const useSession = () => useContext(Context);
