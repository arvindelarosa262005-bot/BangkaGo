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
const Context = createContext<{
  session: Session | null;
  profile: {
    id: string;
    display_name: string;
    role: Role;
    phone: string | null;
    notifications_enabled: boolean;
  } | null;
  loading: boolean;
  error: Error | null;
}>({ session: null, profile: null, loading: true, error: null });
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(configured);
  const qc = useQueryClient();
  const currentUser = useRef<string | null>(null);
  useEffect(() => {
    if (!configured) return;
    supabase.auth.getSession().then(({ data }) => {
      currentUser.current = data.session?.user.id ?? null;
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      const next = s?.user.id ?? null;
      if (currentUser.current !== next) {
        qc.clear();
        currentUser.current = next;
      }
      setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, [qc]);
  const profile = useQuery({
    queryKey: ["profile", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session!.user.id)
        .single();
      if (error) throw error;
      if (data.account_status !== "active")
        throw new Error("Your account is restricted. Please contact support.");
      return data;
    },
  });
  return (
    <Context.Provider
      value={{
        session,
        profile: profile.error ? null : (profile.data ?? null),
        loading: loading || (!!session && profile.isPending),
        error: profile.error,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export const useSession = () => useContext(Context);
