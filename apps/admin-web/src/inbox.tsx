import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, X } from "lucide-react";
import { tripDate } from "@bangkago/shared";
import { configured, supabase } from "./client";
export function Inbox({ userId }: { userId: string | null }) {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const notices = useQuery({
    queryKey: ["admin-notifications", userId],
    enabled: configured && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
  const unread = notices.data?.filter((n) => !n.read_at).length ?? 0;
  const mark = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", userId!);
      if (error) throw error;
    },
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["admin-notifications"] }),
  });
  const markAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .is("read_at", null)
        .eq("user_id", userId!);
      if (error) throw error;
    },
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["admin-notifications"] }),
  });
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          className="icon-button inbox-trigger"
          aria-label={
            unread
              ? `Open notifications, ${unread} unread`
              : "Open notifications"
          }
        >
          <Bell size={20} />
          {unread > 0 && (
            <span className="unread-count">{unread > 9 ? "9+" : unread}</span>
          )}
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog inbox-dialog">
          <div className="dialog-heading">
            <div>
              <Dialog.Title>Notifications</Dialog.Title>
              <Dialog.Description>
                Registration, booking and finance updates for your account.
              </Dialog.Description>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {unread > 0 && (
                <button
                  className="secondary"
                  style={{ minHeight: 34, padding: "6px 12px", fontSize: 11 }}
                  disabled={markAll.isPending}
                  onClick={() => markAll.mutate()}
                >
                  <CheckCheck size={14} />
                  Mark all read
                </button>
              )}
              <Dialog.Close
                className="icon-button"
                aria-label="Close notifications"
              >
                <X size={20} />
              </Dialog.Close>
            </div>
          </div>
          {notices.isFetching && !notices.data ? (
            <p>Loading updates…</p>
          ) : notices.error ? (
            <p className="error">{notices.error.message}</p>
          ) : !notices.data?.length ? (
            <div className="empty">
              <Bell size={28} />
              <h3>You’re all caught up</h3>
              <p>
                {configured
                  ? "New updates will appear automatically."
                  : "Connect your workspace to receive live updates."}
              </p>
            </div>
          ) : (
            notices.data.map((n) => (
              <article
                key={n.id}
                className={`inbox-note ${!n.read_at ? "unread" : ""}`}
              >
                <div>
                  <strong>{n.title}</strong>
                  <p>{n.body}</p>
                  <small>{tripDate(n.created_at)}</small>
                </div>
                {!n.read_at && (
                  <button
                    className="icon-button"
                    aria-label={`Mark ${n.title} as read`}
                    disabled={mark.isPending}
                    onClick={() => mark.mutate(n.id)}
                  >
                    <CheckCheck size={18} />
                  </button>
                )}
              </article>
            ))
          )}
          {mark.error && <p className="error">{mark.error.message}</p>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
