import { ConfigurationEditor } from "./configuration";
import { Inbox } from "./inbox";
import { useLiveWorkspace } from "./live";
import React, { useEffect, useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
  useMutation,
} from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  authSchema,
  php,
  tripDate,
  liveLabels,
  harborDataUri,
  bookingViewStatus,
  type LiveState,
  type Role,
} from "@bangkago/shared";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Anchor,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Compass,
  CreditCard,
  Download,
  FileCheck2,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  MoreHorizontal,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Ship,
  Users,
  Wallet,
  Waves,
  X,
} from "lucide-react";
import { backend, configured, supabase } from "./client";
import "./style.css";
import "./polish.css";
type Row = Record<string, any>;
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15000 } },
});
const navGroups = [
  {
    title: "COMMAND CENTER",
    items: [["Overview", LayoutDashboard]],
  },
  {
    title: "FLEET & OPERATIONS",
    items: [
      ["Boat registrations", Ship],
      ["People", Users],
      ["Bookings", CalendarDays],
    ],
  },
  {
    title: "FINANCE & LEDGER",
    items: [
      ["Payments", CreditCard],
      ["Commissions", Wallet],
      ["Refunds", ArrowDownLeft],
      ["Payouts", ArrowUpRight],
    ],
  },
  {
    title: "GOVERNANCE & SYSTEM",
    items: [
      ["Support", LifeBuoy],
      ["Audit trail", ClipboardList],
      ["Settings", Settings],
    ],
  },
] as const;
const sections = [
  ["Overview", LayoutDashboard],
  ["Boat registrations", Ship],
  ["People", Users],
  ["Bookings", CalendarDays],
  ["Payments", CreditCard],
  ["Commissions", Wallet],
  ["Refunds", ArrowDownLeft],
  ["Payouts", ArrowUpRight],
  ["Support", LifeBuoy],
  ["Audit trail", ClipboardList],
  ["Settings", Settings],
] as const;
const tables: Record<string, string> = {
  "Boat registrations": "boats",
  People: "profiles",
  Bookings: "bookings",
  Payments: "payments",
  Commissions: "platform_commissions",
  Refunds: "refunds",
  Payouts: "payouts",
  Support: "support_tickets",
  "Audit trail": "admin_audit_logs",
  Settings: "app_settings",
};
const status = (r: Row) =>
  r.verification_status ??
  r.account_status ??
  (r.status
    ? bookingViewStatus(
        r as { status: string; reservation_expires_at?: string },
      )
    : undefined) ??
  r.reconciliation_status;
function Badge({ value }: { value: string }) {
  const tone = [
    "approved",
    "active",
    "paid",
    "confirmed",
    "completed",
    "settled",
    "reconciled",
    "resolved",
  ].includes(value)
    ? "good"
    : ["rejected", "suspended", "failed", "cancelled", "expired"].includes(
          value,
        )
      ? "bad"
      : [
            "submitted",
            "under_review",
            "pending_owner_confirmation",
            "awaiting_payment",
            "refund_pending",
            "pending",
            "open",
            "investigating",
          ].includes(value)
        ? "warn"
        : "neutral";
  return (
    <span className={`badge ${tone}`}>
      <i />
      {value?.replaceAll("_", " ") || "—"}
    </span>
  );
}
function Brand() {
  return (
    <div className="brand">
      <span className="brand-icon">
        <Ship size={25} />
      </span>
      <span>
        Bangka<span className="ocean">Go</span>
        <small>OPERATIONS CONSOLE</small>
      </span>
    </div>
  );
}
function Login() {
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function requestAdminOtp(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!/^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(cleanEmail)) {
      setMessage("Mangyaring ilagay ang iyong rehistradong @gmail.com address.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      try {
        const { data: statusData, error: rpcErr } = await supabase.rpc(
          "check_gmail_status",
          { p_email: cleanEmail },
        );
        if (!rpcErr && statusData && !(statusData as any).exists) {
          setMessage(
            `Hindi pa naka-register ang Gmail na ito (${cleanEmail}). Mag-register muna bago mag-sign in.`,
          );
          setBusy(false);
          return;
        }
      } catch {
        // Fallback to shouldCreateUser: false below
      }
      const { error } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) {
        const msg = error.message.toLowerCase();
        if (
          msg.includes("signups not allowed") ||
          msg.includes("user not found") ||
          error.status === 400 ||
          error.status === 422
        ) {
          throw new Error(
            `Hindi pa naka-register ang Gmail na ito (${cleanEmail}). Mag-register muna bago mag-sign in.`,
          );
        }
        throw error;
      }
      setOtpSent(true);
      setMessage(
        `Naipadala na ang OTP sa iyong Gmail inbox (${cleanEmail}). Ilagay ang 6-digit OTP code sa ibaba.`,
      );
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Unable to send OTP to Gmail.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function verifyAdminOtp(e: React.FormEvent) {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    const token = otpCode.trim().replace(/\s+/g, "");
    if (!token) {
      setMessage("Ilagay ang 6-digit OTP code mula sa iyong Gmail inbox.");
      return;
    }
    setBusy(true);
    setMessage("Verifying Gmail OTP…");
    try {
      let lastError: Error | null = null;
      for (const otpType of ["email", "magiclink", "signup"] as const) {
        const { data, error } = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token,
          type: otpType,
        });
        if (!error && data.session) {
          setMessage("Checking administrator access…");
          return;
        }
        if (error) lastError = error;
      }
      throw lastError ?? new Error("Invalid o expired na ang OTP code.");
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Invalid o expired na ang OTP code.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="login-story">
        <Brand />
        <img
          className="login-illustration"
          src={harborDataUri}
          alt="Illustration of a bangka between Philippine shores"
        />
        <div>
          <p className="eyebrow">A BETTER JOURNEY STARTS HERE</p>
          <h1>
            Connecting shores.
            <br />
            Creating possibilities.
          </h1>
          <p>
            One place to care for your passengers, your partners, and every
            journey in between.
          </p>
        </div>
        <small>ABRA DE ILOG · OCCIDENTAL MINDORO</small>
      </div>
      <form
        className="login-form"
        onSubmit={otpSent ? verifyAdminOtp : requestAdminOtp}
      >
        <ShieldCheck size={34} />
        <h2>Welcome back</h2>
        <p>Sign in to your BangkaGo administrator account via Gmail OTP.</p>
        <label>
          Registered Gmail address
          <input
            type="email"
            placeholder="admin@gmail.com"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (otpSent) setOtpSent(false);
            }}
          />
        </label>
        {otpSent && (
          <label>
            6-Digit OTP Code from Gmail Inbox
            <input
              type="text"
              placeholder="123456"
              autoComplete="one-time-code"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
            />
          </label>
        )}
        <button disabled={busy}>
          {otpSent ? "Verify OTP & Sign in" : "Send OTP to Gmail"}{" "}
          <ArrowRight size={16} />
        </button>
        {otpSent && (
          <button
            className="link"
            type="button"
            disabled={busy}
            onClick={(e) => void requestAdminOtp(e)}
          >
            Resend OTP to Gmail
          </button>
        )}
        <button
          type="button"
          className="google-btn"
          disabled={busy}
          onClick={async () => {
            const { error } = await supabase.auth.signInWithOAuth({
              provider: "google",
              options: {
                redirectTo: window.location.origin,
                queryParams: { prompt: "select_account" },
              },
            });
            if (error) setMessage(error.message);
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
            />
            <path
              fill="#FBBC05"
              d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
            />
          </svg>
          Sign in with Google
        </button>
        <p role="status">{message}</p>
        <small>
          Only registered administrator Gmail accounts can access the console.
        </small>
      </form>
    </div>
  );
}
function PasswordReset() {
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <div className="center">
      <form
        className="card"
        onSubmit={async (e) => {
          e.preventDefault();
          const { error } = await supabase.auth.updateUser({ password });
          setMsg(error?.message || "Password updated. Reload to continue.");
        }}
      >
        <h2>Set a new password</h2>
        <input
          type="password"
          minLength={10}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button>Update password</button>
        <p role="status">{msg}</p>
      </form>
    </div>
  );
}
function App() {
  const [user, setUser] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const currentUser = useRef<string | null>(null);
  const [recovery, setRecovery] = useState(false);
  const [ready, setReady] = useState(!configured);
  useEffect(() => {
    if (!configured) return;
    supabase.auth.getSession().then(({ data, error }) => {
      setUser(data.session?.user.id ?? null);
      currentUser.current = data.session?.user.id ?? null;
      setToken(data.session?.access_token ?? null);
      setReady(true);
      if (error) console.error(error.message);
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const next = session?.user.id ?? null;
      if (currentUser.current !== next) {
        queryClient.clear();
        currentUser.current = next;
      }
      setUser(session?.user.id ?? null);
      setToken(session?.access_token ?? null);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  const profile = useQuery({
    queryKey: ["me", user],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("display_name,role,account_status")
        .eq("id", user!)
        .single();
      if (error) throw error;
      return data as {
        display_name: string;
        role: Role;
        account_status: string;
      };
    },
  });
  const live = useLiveWorkspace(
    user,
    token,
    profile.data?.role === "admin" &&
      profile.data?.account_status === "active" &&
      !profile.error,
  );
  if (!ready) return <div className="center">Opening BangkaGo…</div>;
  if (recovery) return <PasswordReset />;
  if (configured && !user) return <Login />;
  if (user && profile.isPending)
    return <div className="center">Verifying access…</div>;
  if (
    user &&
    (profile.error ||
      profile.data?.role !== "admin" ||
      profile.data?.account_status !== "active")
  )
    return (
      <div className="center">
        <div className="card">
          <ShieldCheck />
          <h2>Administrator access required</h2>
          <p>
            {profile.error?.message ||
              "This account cannot open the operations console."}
          </p>
          <button onClick={() => supabase.auth.signOut()}>Sign out</button>
        </div>
      </div>
    );
  return (
    <Console
      name={profile.data?.display_name ?? "Workspace setup"}
      userId={user}
      live={live}
    />
  );
}
function Console({
  name,
  userId,
  live,
}: {
  name: string;
  userId: string | null;
  live: LiveState;
}) {
  const [page, setPage] = useState("Overview");
  const [nav, setNav] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Row | null>(null);
  const [from, setFrom] = useState(
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
  );
  const [notice, setNotice] = useState("");
  const client = useQueryClient();
  const table = tables[page];
  const records = useQuery({
    queryKey: ["records", page],
    enabled: configured && !!table,
    queryFn: () => backend.rows(table),
  });
  const overview = useQuery({
    queryKey: ["overview", from],
    enabled: configured,
    queryFn: async () => {
      const [
        boats,
        bookings,
        profiles,
        payments,
        fees,
        payouts,
        refunds,
        support,
      ] = await Promise.all(
        [
          "boats",
          "bookings",
          "profiles",
          "payments",
          "platform_commissions",
          "payouts",
          "refunds",
          "support_tickets",
        ].map((t) => backend.rows(t)),
      );
      return {
        boats,
        bookings: bookings.filter((r) => r.created_at >= from),
        allBookings: bookings,
        profiles,
        payments: payments.filter((r) => r.created_at >= from),
        fees: fees.filter((r) => r.created_at >= from),
        payouts: payouts.filter((r) => r.created_at >= from),
        allPayouts: payouts,
        refunds: refunds.filter((r) => r.created_at >= from),
        allRefunds: refunds,
        support,
      };
    },
  });
  const rows = (records.data ?? []) as Row[];
  const filtered = rows
    .filter(
      (r) =>
        (filter === "all" || status(r) === filter) &&
        Object.values(r).some((v) =>
          String(v ?? "")
            .toLowerCase()
            .includes(search.toLowerCase()),
        ),
    )
    .slice()
    .sort((a, b) => {
      if (!sortCol) return 0;
      const va = a[sortCol] ?? "";
      const vb = b[sortCol] ?? "";
      const cmp =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), undefined, { numeric: true });
      return sortAsc ? cmp : -cmp;
    });
  const visible = filtered.slice(offset, offset + 10);
  const states = [...new Set(rows.map(status).filter(Boolean))];
  function go(p: string) {
    setPage(p);
    setSearch("");
    setFilter("all");
    setSortCol(null);
    setSortAsc(true);
    setOffset(0);
    setNav(false);
    setSelected(null);
  }
  function toggleSort(col: string) {
    if (sortCol === col) setSortAsc(!sortAsc);
    else {
      setSortCol(col);
      setSortAsc(true);
    }
    setOffset(0);
  }
  const money = (
    data: Row[] | undefined,
    col: string,
    predicate = (r: Row) => true,
  ) =>
    (data ?? []).filter(predicate).reduce((n, r) => n + Number(r[col] ?? 0), 0);
  const o = overview.data;
  const columns: Record<string, string[]> = {
    boats: [
      "name",
      "boat_type",
      "capacity",
      "verification_status",
      "created_at",
    ],
    profiles: ["display_name", "role", "account_status", "created_at"],
    bookings: [
      "reference",
      "mode",
      "passenger_count",
      "total_minor",
      "status",
      "created_at",
    ],
    payments: [
      "provider_checkout_id",
      "provider",
      "amount_minor",
      "status",
      "verified_at",
    ],
    platform_commissions: [
      "booking_id",
      "commission_minor",
      "operator_minor",
      "reconciliation_status",
    ],
    refunds: ["booking_id", "amount_minor", "status", "reason"],
    payouts: ["owner_id", "amount_minor", "status", "bank_reference"],
    support_tickets: ["subject", "status", "created_at"],
    admin_audit_logs: ["action", "target_id", "reason", "created_at"],
    app_settings: ["key", "value"],
  };
  function csv() {
    if (!configured) return;
    const cols = columns[table];
    const escape = (v: unknown) => {
      let s = typeof v === "object" ? JSON.stringify(v) : String(v ?? "");
      if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replaceAll('"', '""') + '"';
    };
    const blob = new Blob(
      [
        "\uFEFF" +
          [
            cols.map(escape).join(","),
            ...filtered.map((r) => cols.map((c) => escape(r[c])).join(",")),
          ].join("\r\n"),
      ],
      { type: "text/csv;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bangkago-${table}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  const badgeCount = (label: string) => {
    if (!o) return 0;
    if (label === "Boat registrations")
      return o.boats.filter((b) =>
        ["submitted", "under_review"].includes(b.verification_status),
      ).length;
    if (label === "Bookings")
      return (o.allBookings ?? o.bookings).filter((b) =>
        ["pending_owner_confirmation", "awaiting_payment"].includes(
          bookingViewStatus(b),
        ),
      ).length;
    if (label === "Payouts")
      return (o.allPayouts ?? o.payouts).filter((p) => p.status === "pending")
        .length;
    if (label === "Refunds")
      return (o.allRefunds ?? o.refunds).filter((r) => r.status === "requested")
        .length;
    if (label === "Support")
      return (o.support ?? []).filter((s) => s.status !== "resolved").length;
    return 0;
  };
  return (
    <div className="shell">
      {nav && (
        <div
          className="sidebar-backdrop"
          aria-hidden="true"
          onClick={() => setNav(false)}
        />
      )}
      <aside className={nav ? "sidebar open" : "sidebar"}>
        <div className="sidebar-top">
          <Brand />
          <button
            type="button"
            className="icon-button mobile-close"
            aria-label="Close navigation"
            onClick={() => setNav(false)}
          >
            <X size={18} />
          </button>
        </div>
        <nav aria-label="Main navigation">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.title}>
              <p className="nav-label">{group.title}</p>
              {group.items.map(([label, Icon]) => {
                const count = badgeCount(label);
                return (
                  <button
                    key={label}
                    aria-label={label}
                    className={page === label ? "nav-item chosen" : "nav-item"}
                    onClick={() => go(label)}
                  >
                    <Icon size={18} />
                    <span className="nav-text">{label}</span>
                    {count > 0 && (
                      <span className="count" aria-hidden="true">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-bottom">
            <span className="port-icon">
              <Anchor size={19} />
            </span>
            <div>
              <strong>Abra de Ilog</strong>
              <small>Occidental Mindoro, PH</small>
            </div>
          </div>
          <div className="profile">
            <div className="avatar">{name.slice(0, 2).toUpperCase()}</div>
            <div className="profile-meta">
              <strong>{name}</strong>
              <small>
                {configured ? "Administrator" : "Configuration required"}
              </small>
            </div>
            {configured && (
              <button
                aria-label="Sign out"
                className="icon-button"
                onClick={() => supabase.auth.signOut()}
              >
                <LogOut size={17} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Toggle navigation"
              onClick={() => setNav(!nav)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <ChevronRight size={14} />
            <strong>{page}</strong>
          </div>
          <div className="header-right">
            <div className="quick-jump">
              <Compass size={15} />
              <select
                aria-label="Quick jump to section"
                value={page}
                onChange={(e) => go(e.target.value)}
              >
                {sections.map(([label]) => (
                  <option key={label} value={label}>
                    Jump to: {label}
                  </option>
                ))}
              </select>
            </div>
            <span
              className={`workspace-status phase-${live.phase}`}
              role="status"
            >
              <i />
              {configured ? liveLabels[live.phase] : "Awaiting configuration"}
            </span>
            <Inbox userId={userId} />
            <div className="avatar small">{name.slice(0, 2).toUpperCase()}</div>
          </div>
        </header>
        <main>
          <div
            className={
              page === "Overview"
                ? "page-heading overview-heading"
                : "page-heading"
            }
          >
            {page === "Overview" && (
              <img
                className="overview-art"
                src={harborDataUri}
                alt=""
                aria-hidden="true"
              />
            )}
            <div>
              <p className="eyebrow">BANGKAGO OPERATIONS</p>
              <h1>{page === "Overview" ? "Every journey, in view." : page}</h1>
              <p>
                {page === "Overview"
                  ? "A clear picture of your people, boats, and bookings."
                  : `Review and manage ${page.toLowerCase()} across your workspace.`}
              </p>
              {page === "Overview" && (
                <div className="hero-chips">
                  <span className="hero-chip">
                    <Ship size={13} />
                    {configured && o
                      ? `${o.boats.filter((b) => b.active && b.verification_status === "approved").length} Active Vessels`
                      : "Fleet Monitoring"}
                  </span>
                  <span className="hero-chip">
                    <ShieldCheck size={13} />
                    {configured && o
                      ? `${badgeCount("Boat registrations")} Pending Verifications`
                      : "Safety & Permit Gate"}
                  </span>
                  <span className="hero-chip">
                    <LifeBuoy size={13} />
                    {configured && o
                      ? `${badgeCount("Support")} Open Support Cases`
                      : "Passenger Support Desk"}
                  </span>
                </div>
              )}
            </div>
            <div className="heading-actions">
              <button
                className="secondary"
                onClick={() => {
                  client.invalidateQueries();
                  setNotice(
                    configured
                      ? "Data refreshed."
                      : "Connect your BangkaGo project to load records.",
                  );
                }}
              >
                <RefreshCw size={16} />
                Refresh
              </button>
              {table && (
                <button disabled={!configured} onClick={csv}>
                  <Download size={16} />
                  Export CSV
                </button>
              )}
            </div>
          </div>
          {!configured && (
            <div className="configuration">
              <div className="config-icon">
                <Compass size={23} />
              </div>
              <div>
                <strong>Your operations workspace is ready to connect</strong>
                <p>
                  Add your BangkaGo Supabase URL and publishable key, then apply
                  the database migrations. Real records will appear here once
                  connected.
                </p>
              </div>
              <button className="secondary" onClick={() => go("Settings")}>
                View setup <ArrowRight size={15} />
              </button>
            </div>
          )}
          {notice && (
            <div className="notice" role="status">
              {notice}
              <button
                className="icon-button"
                onClick={() => setNotice("")}
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          )}
          {(records.error || overview.error) && (
            <div className="error" role="alert">
              Unable to load records:{" "}
              {(records.error || overview.error)?.message}.{" "}
              <button
                className="link"
                onClick={() => client.invalidateQueries()}
              >
                Try again
              </button>
            </div>
          )}
          {page === "Overview" ? (
            <>
              <div className="section-title">
                <h2>Platform overview</h2>
                <div className="date-controls">
                  <div className="date-presets" role="group" aria-label="Date range presets">
                    {[
                      ["7D", 7],
                      ["30D", 30],
                      ["90D", 90],
                      ["1Y", 365],
                    ].map(([label, days]) => {
                      const target = new Date(
                        Date.now() - Number(days) * 86400000,
                      )
                        .toISOString()
                        .slice(0, 10);
                      return (
                        <button
                          key={label}
                          type="button"
                          className={
                            from === target
                              ? "preset-chip active"
                              : "preset-chip"
                          }
                          onClick={() => setFrom(target)}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                  <label className="date-field">
                    <CalendarDays size={16} />
                    <input
                      aria-label="Report start date"
                      type="date"
                      value={from}
                      onChange={(e) => setFrom(e.target.value)}
                    />
                    <span>to today</span>
                  </label>
                </div>
              </div>
              <div className="metrics">
                {[
                  {
                    label: "Gross booking value",
                    value:
                      configured && o
                        ? php(money(o.bookings, "total_minor"))
                        : "—",
                    icon: Wallet,
                    caption: "Booking value · includes unpaid requests",
                    target: "Bookings",
                  },
                  {
                    label: "Verified collections",
                    value:
                      configured && o
                        ? php(
                            money(
                              o.payments,
                              "amount_minor",
                              (r) => r.status === "paid",
                            ),
                          )
                        : "—",
                    icon: CreditCard,
                    caption: "Provider-confirmed payments only",
                    target: "Payments",
                  },
                  {
                    label: "Active boats",
                    value:
                      configured && o
                        ? String(
                            o.boats.filter(
                              (r) =>
                                r.active &&
                                r.verification_status === "approved",
                            ).length,
                          )
                        : "—",
                    icon: Ship,
                    caption: "Approved and operating",
                    target: "Boat registrations",
                  },
                  {
                    label: "Registered people",
                    value: configured && o ? String(o.profiles.length) : "—",
                    icon: Users,
                    caption: o
                      ? `${o.profiles.filter((r) => r.role === "passenger").length} passengers · ${o.profiles.filter((r) => r.role === "owner").length} operators`
                      : "Passengers and boat operators",
                    target: "People",
                  },
                ].map(({ label, value, icon: Icon, caption, target }) => (
                  <section
                    key={label}
                    className="metric clickable-metric"
                    onClick={() => go(target)}
                  >
                    <div>
                      <span>{label}</span>
                      <Icon size={20} />
                    </div>
                    <strong>{value}</strong>
                    <small>{caption}</small>
                  </section>
                ))}
              </div>
              <div className="priority-strip">
                {[
                  {
                    title: "Boat Approvals",
                    count: configured ? badgeCount("Boat registrations") : "—",
                    sub: "Vessels awaiting permit review",
                    tone: badgeCount("Boat registrations") > 0 ? "warn" : "good",
                    dest: "Boat registrations",
                  },
                  {
                    title: "Active Reservations",
                    count: configured ? badgeCount("Bookings") : "—",
                    sub: "Pending confirmation or payment",
                    tone: badgeCount("Bookings") > 0 ? "warn" : "neutral",
                    dest: "Bookings",
                  },
                  {
                    title: "Owner Payout Queue",
                    count: configured ? badgeCount("Payouts") : "—",
                    sub: "Ready for bank settlement",
                    tone: badgeCount("Payouts") > 0 ? "warn" : "good",
                    dest: "Payouts",
                  },
                  {
                    title: "Support Desk",
                    count: configured ? badgeCount("Support") : "—",
                    sub: "Open & investigating tickets",
                    tone: badgeCount("Support") > 0 ? "bad" : "good",
                    dest: "Support",
                  },
                ].map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    className={`priority-card tone-${item.tone}`}
                    onClick={() => go(item.dest)}
                  >
                    <div className="priority-head">
                      <span>{item.title}</span>
                      <strong className="priority-num">{item.count}</strong>
                    </div>
                    <small>{item.sub}</small>
                  </button>
                ))}
              </div>
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Booking activity</h2>
                      <p>Requests and journeys over the last seven days</p>
                    </div>
                    <span className="legend">
                      <i />
                      Bookings
                    </span>
                  </div>
                  <div className="chart">
                    {Array.from({ length: 7 }, (_, i) => {
                      const date = new Date(Date.now() - (6 - i) * 86400000);
                      const key = date.toISOString().slice(0, 10);
                      const count =
                        o?.bookings.filter((r) => r.created_at.startsWith(key))
                          .length ?? 0;
                      const max = Math.max(
                        1,
                        ...Array.from(
                          { length: 7 },
                          (_, j) =>
                            o?.bookings.filter((r) =>
                              r.created_at.startsWith(
                                new Date(Date.now() - (6 - j) * 86400000)
                                  .toISOString()
                                  .slice(0, 10),
                              ),
                            ).length ?? 0,
                        ),
                      );
                      return (
                        <div className="chart-column" key={i}>
                          <span>{configured ? count : "—"}</span>
                          <div className="chart-track">
                            <div
                              className="chart-bar"
                              style={{ height: `${(count / max) * 100}%` }}
                            />
                          </div>
                          <small>
                            {date.toLocaleDateString("en-PH", {
                              weekday: "short",
                            })}
                          </small>
                        </div>
                      );
                    })}
                  </div>
                  {configured && o && (
                    <div className="status-breakdown">
                      {[
                        {
                          label: "Confirmed & Completed",
                          count: o.bookings.filter((b) =>
                            ["confirmed", "completed"].includes(
                              bookingViewStatus(b),
                            ),
                          ).length,
                          color: "#16a34a",
                        },
                        {
                          label: "Pending / Awaiting Payment",
                          count: o.bookings.filter((b) =>
                            [
                              "pending_owner_confirmation",
                              "awaiting_payment",
                            ].includes(bookingViewStatus(b)),
                          ).length,
                          color: "#d97706",
                        },
                        {
                          label: "Cancelled / Expired / Refunded",
                          count: o.bookings.filter((b) =>
                            [
                              "cancelled",
                              "rejected",
                              "expired",
                              "refunded",
                              "refund_pending",
                            ].includes(bookingViewStatus(b)),
                          ).length,
                          color: "#64748b",
                        },
                      ].map((row) => {
                        const total = Math.max(1, o.bookings.length);
                        const pct = Math.round((row.count / total) * 100);
                        return (
                          <div key={row.label} className="breakdown-item">
                            <div className="breakdown-label">
                              <span>{row.label}</span>
                              <strong>
                                {row.count} ({o.bookings.length ? pct : 0}%)
                              </strong>
                            </div>
                            <div className="breakdown-bar">
                              <div
                                style={{
                                  width: `${o.bookings.length ? pct : 0}%`,
                                  background: row.color,
                                }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
                <section className="panel review-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Ready for review</h2>
                      <p>Keep the next journey moving</p>
                    </div>
                    <FileCheck2 size={23} />
                  </div>
                  <div className="review-number">
                    {configured && o
                      ? o.boats.filter((r) =>
                          ["submitted", "under_review"].includes(
                            r.verification_status,
                          ),
                        ).length
                      : "—"}
                    <span>
                      boat registrations
                      <br />
                      awaiting a decision
                    </span>
                  </div>
                  <div className="review-info">
                    <ShieldCheck size={18} />
                    <span>
                      Review documents and safety information before approving a
                      boat.
                    </span>
                  </div>
                  <button onClick={() => go("Boat registrations")}>
                    Review registrations <ArrowRight size={16} />
                  </button>
                </section>
              </div>
              <section className="panel">
                <div className="panel-heading">
                  <div>
                    <h2>Recent bookings</h2>
                    <p>The latest requests across your routes</p>
                  </div>
                  <button className="link" onClick={() => go("Bookings")}>
                    View all bookings <ArrowRight size={15} />
                  </button>
                </div>
                {o?.bookings.length ? (
                  <DataTable
                    rows={o.bookings
                      .slice()
                      .sort((a, b) => b.created_at.localeCompare(a.created_at))
                      .slice(0, 5)}
                    cols={columns.bookings}
                    select={(r) => {
                      go("Bookings");
                      setSelected(r);
                    }}
                  />
                ) : (
                  <Empty
                    icon="booking"
                    title={
                      configured
                        ? "No bookings yet"
                        : "Your first journey starts here"
                    }
                    text={
                      configured
                        ? "Bookings will appear when passengers reserve an approved schedule."
                        : "Connect your database to see booking requests and trip activity."
                    }
                  />
                )}
              </section>
              <div className="finance-strip">
                {[
                  [
                    "Platform commissions",
                    php(
                      money(
                        o?.fees,
                        "commission_minor",
                        (r) => r.reconciliation_status !== "reversed",
                      ),
                    ),
                  ],
                  [
                    "Refunds confirmed",
                    php(
                      money(
                        o?.refunds,
                        "amount_minor",
                        (r) => r.status === "confirmed",
                      ),
                    ),
                  ],
                  [
                    "Owner payouts settled",
                    php(
                      money(
                        o?.payouts,
                        "amount_minor",
                        (r) => r.status === "settled",
                      ),
                    ),
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <small>{label}</small>
                    <strong>{configured && o ? value : "—"}</strong>
                  </div>
                ))}
              </div>
            </>
          ) : page === "Settings" ? (
            <SettingsPanel configured={configured} />
          ) : (
            <section className="panel">
              <div className="table-toolbar">
                <div className="search">
                  <Search size={17} />
                  <input
                    aria-label={`Search ${page}`}
                    placeholder={`Search ${page.toLowerCase()}…`}
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setOffset(0);
                    }}
                  />
                  {search && (
                    <button
                      type="button"
                      className="icon-button"
                      aria-label="Clear search"
                      onClick={() => {
                        setSearch("");
                        setOffset(0);
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
                <select
                  aria-label="Filter status"
                  value={filter}
                  onChange={(e) => {
                    setFilter(e.target.value);
                    setOffset(0);
                  }}
                >
                  <option value="all">All statuses</option>
                  {states.map((s) => (
                    <option key={s} value={s}>
                      {s.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
                <span>{filtered.length} records</span>
              </div>
              {states.length > 0 && (
                <div className="status-pills" role="group" aria-label="Status quick filters">
                  <button
                    type="button"
                    className={
                      filter === "all" ? "preset-chip active" : "preset-chip"
                    }
                    onClick={() => {
                      setFilter("all");
                      setOffset(0);
                    }}
                  >
                    All ({rows.length})
                  </button>
                  {states.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={
                        filter === s ? "preset-chip active" : "preset-chip"
                      }
                      onClick={() => {
                        setFilter(s);
                        setOffset(0);
                      }}
                    >
                      {s.replaceAll("_", " ")} (
                      {rows.filter((r) => status(r) === s).length})
                    </button>
                  ))}
                </div>
              )}
              {records.isFetching ? (
                <div className="empty">Loading records…</div>
              ) : visible.length ? (
                <DataTable
                  rows={visible}
                  cols={columns[table]}
                  select={setSelected}
                  sortCol={sortCol}
                  sortAsc={sortAsc}
                  onSort={toggleSort}
                />
              ) : (
                <Empty
                  title={
                    search || filter !== "all"
                      ? "No matching records"
                      : `No ${page.toLowerCase()} yet`
                  }
                  text={
                    configured
                      ? "Records will appear here as your platform grows."
                      : "Connect your BangkaGo project to load live records."
                  }
                />
              )}
              <div className="pagination">
                <span>
                  {filtered.length
                    ? `${offset + 1}–${Math.min(offset + 10, filtered.length)} of ${filtered.length}`
                    : "0 records"}
                </span>
                <button
                  className="secondary"
                  aria-label="Previous page"
                  disabled={offset === 0}
                  onClick={() => setOffset(offset - 10)}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="secondary"
                  aria-label="Next page"
                  disabled={offset + 10 >= filtered.length}
                  onClick={() => setOffset(offset + 10)}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </section>
          )}
          <footer>
            <span>
              <Waves size={17} /> Your Journey, Your Boat.
            </span>
            <span>BangkaGo · Philippines</span>
          </footer>
        </main>
      </div>
      {selected && (
        <RecordDialog
          page={page}
          row={rows.find((r) => r.id === selected.id) ?? selected}
          close={() => setSelected(null)}
          refresh={() => client.invalidateQueries()}
        />
      )}
    </div>
  );
}
function Empty({
  title,
  text,
  icon,
}: {
  title: string;
  text: string;
  icon?: string;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        {icon === "booking" ? (
          <CalendarDays size={29} />
        ) : (
          <Compass size={29} />
        )}
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
function format(key: string, value: any) {
  if (value === null || value === undefined) return "—";
  if (key.endsWith("_minor")) return php(Number(value));
  if (key.endsWith("_at")) return tripDate(value);
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}
function DataTable({
  rows,
  cols,
  select,
  sortCol,
  sortAsc,
  onSort,
}: {
  rows: Row[];
  cols: string[];
  select: (r: Row) => void;
  sortCol?: string | null;
  sortAsc?: boolean;
  onSort?: (col: string) => void;
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {cols.map((c) => (
              <th
                key={c}
                onClick={() => onSort?.(c)}
                style={onSort ? { cursor: "pointer", userSelect: "none" } : undefined}
              >
                {c.replaceAll("_minor", "").replaceAll("_", " ")}
                {sortCol === c ? (sortAsc ? " ↑" : " ↓") : ""}
              </th>
            ))}
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.id ?? r.key ?? i}
              onClick={() => select(r)}
              style={{ cursor: "pointer" }}
            >
              {cols.map((c, j) => (
                <td key={c}>
                  {c.includes("status") ? (
                    <Badge
                      value={
                        c === "status" && r.reservation_expires_at
                          ? bookingViewStatus(
                              r as {
                                status: string;
                                reservation_expires_at?: string;
                              },
                            )
                          : r[c]
                      }
                    />
                  ) : (
                    <span className={j === 0 ? "primary-cell" : ""}>
                      {format(c, r[c])}
                    </span>
                  )}
                </td>
              ))}
              <td>
                <button
                  className="icon-button"
                  aria-label="Review record"
                  onClick={(e) => {
                    e.stopPropagation();
                    select(r);
                  }}
                >
                  <MoreHorizontal size={19} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function RecordDialog({
  page,
  row,
  close,
  refresh,
}: {
  page: string;
  row: Row;
  close: () => void;
  refresh: () => void;
}) {
  const [reason, setReason] = useState("");
  const [bank, setBank] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const mutation = useMutation({
    mutationFn: async (action: string) => {
      if (reason.trim().length < 5)
        throw new Error("Enter a reason of at least five characters.");
      if (page === "Boat registrations")
        return backend.edge("approve-boat", {
          boat_id: row.id,
          status: action,
          reason,
        });
      if (page === "People")
        return backend.rpc("admin_action", {
          p_action: "account_status",
          p_id: row.id,
          p_data: { status: action, reason },
        });
      if (page === "Payouts")
        return backend.edge("process-payout", {
          id: row.id,
          reason,
          bank_reference: bank,
        });
      if (page === "Refunds")
        return backend.edge("process-refund", { id: row.id, reason });
      if (page === "Payments")
        return backend.edge("reconcile-payment", { id: row.id });
      if (page === "Bookings")
        return backend.rpc("booking_action", {
          p_id: row.id,
          p_action: action,
          p_reason: reason,
        });
      if (page === "Support")
        return backend.rpc("admin_action", {
          p_action: action,
          p_id: row.id,
          p_data: { reason },
        });
    },
    onSuccess: () => {
      setMessage("Saved and recorded in the audit trail.");
      refresh();
    },
    onError: (e) => setMessage(e.message),
  });
  const docs = useQuery({
    queryKey: ["documents", row.id],
    enabled: page === "Boat registrations",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boat_documents")
        .select("*,document_requirements(name)")
        .eq("boat_id", row.id);
      if (error) throw error;
      return data;
    },
  });
  const history = useQuery({
    queryKey: ["history", row.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_audit_logs")
        .select("*")
        .eq("target_id", row.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const actions =
    page === "Boat registrations"
      ? [
          "under_review",
          "approved",
          "needs_correction",
          "rejected",
          "suspended",
        ]
      : page === "People"
        ? [row.account_status === "active" ? "suspended" : "active"]
        : page === "Payouts" && row.status === "pending"
          ? ["payout_settle"]
          : page === "Refunds" && row.status !== "confirmed"
            ? ["process_refund"]
            : page === "Payments" && !["paid", "refunded"].includes(row.status)
              ? ["reconcile"]
              : page === "Bookings" &&
                  [
                    "confirmed",
                    "awaiting_payment",
                    "pending_owner_confirmation",
                  ].includes(row.status)
                ? ["cancel"]
                : page === "Support" && row.status !== "resolved"
                  ? row.status === "open"
                    ? ["support_investigate", "support_resolve"]
                    : ["support_resolve"]
                  : [];
  const currentState = status(row);
  return (
    <Dialog.Root open onOpenChange={(v) => !v && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog">
          <div className="dialog-heading">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <Dialog.Title>
                  {row.name ??
                    row.reference ??
                    row.display_name ??
                    "Record details"}
                </Dialog.Title>
                {currentState && <Badge value={currentState} />}
              </div>
              <Dialog.Description>
                {page} · {row.id ?? row.key}
              </Dialog.Description>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {(row.reference ?? row.id ?? row.key) && (
                <button
                  type="button"
                  className="preset-chip"
                  onClick={() => {
                    void navigator.clipboard?.writeText(
                      String(row.reference ?? row.id ?? row.key),
                    );
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1800);
                  }}
                >
                  {copied ? "Copied!" : "Copy ID"}
                </button>
              )}
              <Dialog.Close className="icon-button" aria-label="Close details">
                <X size={20} />
              </Dialog.Close>
            </div>
          </div>
          <dl>
            {Object.entries(row).map(([k, v]) => (
              <div key={k} className="dl-card">
                <dt>{k.replaceAll("_", " ")}</dt>
                <dd>{format(k, v)}</dd>
              </div>
            ))}
          </dl>
          {page === "Boat registrations" && (
            <>
              <h3>Registration documents</h3>
              {docs.isPending ? (
                <p>Loading documents…</p>
              ) : docs.error ? (
                <p className="error">{docs.error.message}</p>
              ) : docs.data?.length ? (
                docs.data.map((d) => (
                  <div className="document" key={d.id}>
                    <FileCheck2 size={18} />
                    <span>
                      {d.document_requirements?.name}
                      <small>Expires: {d.expires_on ?? "Not specified"}</small>
                    </span>
                    <button
                      className="secondary"
                      onClick={async () => {
                        const { data, error } = await supabase.storage
                          .from("boat-documents")
                          .createSignedUrl(d.storage_path, 60);
                        if (error) setMessage(error.message);
                        else
                          window.open(
                            data.signedUrl,
                            "_blank",
                            "noopener,noreferrer",
                          );
                      }}
                    >
                      View document
                    </button>
                  </div>
                ))
              ) : (
                <p>No documents submitted.</p>
              )}
            </>
          )}
          {!!actions.length && (
            <div className="actions">
              <label>
                Decision reason / investigation notes
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  minLength={5}
                  placeholder="Provide clear audit notes (at least 5 characters)…"
                />
              </label>
              {page === "Payouts" && (
                <label>
                  Verified bank transfer reference
                  <input
                    value={bank}
                    onChange={(e) => setBank(e.target.value)}
                    placeholder="e.g. INSTAPAY-2026-..."
                  />
                </label>
              )}
              <div className="button-row">
                {actions.map((a) => (
                  <button
                    key={a}
                    disabled={mutation.isPending}
                    className={
                      ["rejected", "suspended", "cancel"].includes(a)
                        ? "danger"
                        : "secondary"
                    }
                    onClick={() => mutation.mutate(a)}
                  >
                    {a.replaceAll("_", " ")}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p role="status">{message}</p>
          <h3>Review history</h3>
          {history.error ? (
            <p className="error">{history.error.message}</p>
          ) : history.data?.length ? (
            <div className="history-timeline">
              {history.data.map((h) => (
                <div className="history-item" key={h.id}>
                  <strong>{h.action.replaceAll("_", " ")}</strong>
                  <span>{h.reason}</span>
                  <small>{tripDate(h.created_at)}</small>
                </div>
              ))}
            </div>
          ) : (
            <p>No administrative decisions recorded.</p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
function SettingsPanel({ configured }: { configured: boolean }) {
  const [rate, setRate] = useState("10");
  const [fee, setFee] = useState("0");
  const [effective, setEffective] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const mutation = useMutation({
    mutationFn: () =>
      backend.rpc("admin_action", {
        p_action: "commission",
        p_id: null,
        p_data: {
          rate_bps: Math.round(Number(rate) * 100),
          service_fee_minor: Math.round(Number(fee) * 100),
          effective_at: new Date(effective).toISOString(),
          reason,
        },
      }),
    onSuccess: () =>
      setMsg(
        "New rule saved. Historical bookings retain their original fee snapshots.",
      ),
    onError: (e) => setMsg(e.message),
  });
  return (
    <div className="settings-grid">
      <section className="panel padded">
        <h2>Workspace connection</h2>
        <p>
          <Badge value={configured ? "active" : "awaiting_configuration"} />
        </p>
        <ol>
          <li>Create a dedicated BangkaGo Supabase project.</li>
          <li>Apply migrations and development seed data.</li>
          <li>Set the admin and mobile public environment variables.</li>
          <li>Provision your first administrator on the server.</li>
          <li>Configure merchant credentials in Edge Function secrets.</li>
        </ol>
        <p>See the project setup guide for commands and deployment steps.</p>
        <h3>Payments and payouts</h3>
        <p>
          GCash checkout requires an eligible PayMongo merchant account.
          Credentials stay on the server. Payouts use an authorized bank
          reconciliation workflow.
        </p>
      </section>
      <form
        className="panel padded"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <h2>Commission rules</h2>
        <p>
          10% is the initial testing default, subject to business approval. New
          rules apply only to future bookings.
        </p>
        <label>
          Commission percentage
          <input
            type="number"
            min="0"
            max="100"
            step="0.01"
            required
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
        </label>
        <label>
          Passenger service fee (PHP)
          <input
            type="number"
            min="0"
            step="0.01"
            required
            value={fee}
            onChange={(e) => setFee(e.target.value)}
          />
        </label>
        <label>
          Effective from
          <input
            type="datetime-local"
            required
            value={effective}
            onChange={(e) => setEffective(e.target.value)}
          />
        </label>
        <label>
          Reason
          <textarea
            required
            minLength={5}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <button disabled={!configured || mutation.isPending}>
          <Check size={16} />
          Save new rule
        </button>
        <p role="status">{msg}</p>
      </form>
      <ConfigurationEditor />
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
