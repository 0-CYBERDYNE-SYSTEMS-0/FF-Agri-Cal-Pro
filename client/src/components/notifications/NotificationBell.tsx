import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";

interface Proposal {
  id: number;
  type: string;
  title: string;
  rationale: string;
  status: string;
  changeset: Array<{ eventId: number; updates: Record<string, string> }> | null;
}

interface Notification {
  id: number;
  proposalId: number | null;
  type: string;
  title: string;
  body: string | null;
  read: boolean;
  createdAt: string;
}

interface InboxData {
  notifications: Notification[];
  unreadCount: number;
}

const TYPE_BADGE: Record<string, string> = {
  proposal: "bg-amber-100 text-amber-800",
  applied: "bg-green-100 text-green-800",
  declined: "bg-neutral-100 text-neutral-600",
  info: "bg-blue-100 text-blue-800",
};

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();
  const containerRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery<InboxData>({
    queryKey: ["/api/notifications"],
    refetchInterval: 30 * 1000, // the watch runs server-side; keep the bell fresh
  });

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const invalidateInbox = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
  };

  const markRead = useMutation({
    mutationFn: async (id: number) => apiRequest("POST", `/api/notifications/${id}/read`),
    onSuccess: invalidateInbox,
  });

  const markAllRead = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/notifications/read-all"),
    onSuccess: invalidateInbox,
  });

  const decide = useMutation({
    mutationFn: async ({ proposalId, decision }: { proposalId: number; decision: "approve" | "decline" }) =>
      apiRequest("POST", `/api/proposals/${proposalId}/${decision}`),
    onSuccess: () => {
      invalidateInbox();
      // Applied proposals change the calendar
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/proposals"] });
    },
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <div className="relative" ref={containerRef}>
      <button
        id="notifications-btn"
        className="text-neutral-600 hover:text-primary transition relative"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 h-4 min-w-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 max-w-[90vw] bg-white rounded-lg shadow-xl border border-neutral-200 z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
            <span className="font-medium text-sm">Notifications</span>
            {unreadCount > 0 && (
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-neutral-500">
                Nothing yet. The farm manager watches your weather-dependent events
                and flags problems here before they happen.
              </div>
            ) : (
              notifications.map(notification => {
                return (
                  <div
                    key={notification.id}
                    className={`px-4 py-3 border-b border-neutral-50 ${!notification.read ? "bg-amber-50/40" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${TYPE_BADGE[notification.type] ?? TYPE_BADGE.info}`}>
                            {notification.type}
                          </span>
                          <span className="text-xs text-neutral-400">{timeAgo(notification.createdAt)}</span>
                        </div>
                        <p className="text-sm font-medium mt-1">{notification.title}</p>
                        {notification.body && (
                          <p className="text-xs text-neutral-600 mt-0.5">{notification.body}</p>
                        )}
                        {notification.proposalId != null && notification.type === "proposal" && (
                          <div className="flex gap-2 mt-2">
                            <Button
                              size="sm"
                              className="h-7 px-3 text-xs bg-primary hover:bg-primary-dark"
                              disabled={decide.isPending}
                              onClick={() => decide.mutate({ proposalId: notification.proposalId!, decision: "approve" })}
                            >
                              Apply
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-3 text-xs"
                              disabled={decide.isPending}
                              onClick={() => decide.mutate({ proposalId: notification.proposalId!, decision: "decline" })}
                            >
                              Dismiss
                            </Button>
                          </div>
                        )}
                      </div>
                      {!notification.read && (
                        <button
                          className="text-xs text-neutral-400 hover:text-primary shrink-0"
                          onClick={() => markRead.mutate(notification.id)}
                        >
                          mark read
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
