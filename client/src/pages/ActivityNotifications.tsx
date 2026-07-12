import React, { useState, useEffect } from "react";

interface AppNotification {
  id: number;
  message: string;
  type: "alert" | "approval" | "booking" | "assignment";
  is_read: boolean;
  created_at: string;
}

const API_BASE = "http://localhost:8000/api";

export default function ActivityNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [activeFilter, setActiveFilter] = useState<"all" | "alert" | "approval" | "booking">("all");
  
  // Loading & error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch notifications
  useEffect(() => {
    async function fetchNotifications() {
      setLoading(true);
      setError(null);
      try {
        const typeQuery = activeFilter !== "all" ? `?type=${activeFilter}` : "";
        const response = await fetch(`${API_BASE}/notifications${typeQuery}`);
        if (!response.ok) {
          throw new Error("Failed to load activity logs.");
        }
        setNotifications(await response.json());
      } catch (err: any) {
        setError(err.message || "An error occurred.");
      } finally {
        setLoading(false);
      }
    }
    fetchNotifications();
  }, [activeFilter]);

  // Mark notification as read
  const handleMarkAsRead = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE}/notifications/${id}/read`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" }
      });

      if (response.ok) {
        setNotifications((prev) =>
          prev.map((notif) => (notif.id === id ? { ...notif, is_read: true } : notif))
        );
      }
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      const response = await fetch(`${API_BASE}/notifications/read-all`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" }
      });

      if (response.ok) {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      }
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  };

  // Helper relative time formatter
  const getRelativeTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  // Notification Icon type mapper
  const getNotificationIcon = (type: AppNotification["type"]) => {
    switch (type) {
      case "alert":
        return (
          <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-900/50 text-rose-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        );
      case "approval":
        return (
          <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-900/50 text-emerald-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
      case "booking":
        return (
          <div className="p-2 rounded-lg bg-blue-950/40 border border-blue-900/50 text-blue-400">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        );
      case "assignment":
      default:
        return (
          <div className="p-2 rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-300">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
        );
    }
  };

  const getUnreadCount = () => {
    return notifications.filter((n) => !n.is_read).length;
  };

  return (
    <div className="min-h-screen bg-[#0d0f12] text-[#f3f4f6] p-6 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
            Activity & Notifications
          </h1>
          <p className="text-neutral-400 text-sm mt-1">Audit logs, system flags, and asset event alerts</p>
        </div>

        {getUnreadCount() > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="self-start sm:self-auto text-xs bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-neutral-600 text-white font-bold px-4 py-2 rounded-xl transition-all cursor-pointer"
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2.5 mb-6">
        {(["all", "alert", "approval", "booking"] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all uppercase cursor-pointer border ${
              activeFilter === filter
                ? "bg-[#2d3746] border-[#3f4f64] text-white"
                : "bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white"
            }`}
          >
            {filter}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-12 text-center text-neutral-400">
          <svg className="animate-spin h-8 w-8 text-emerald-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p>Loading activity logs...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-950/40 border border-rose-800/80 rounded-2xl p-6 text-center text-rose-400">
          <p className="font-bold">Error Loading View</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-[#15191f] border border-[#232a35] rounded-2xl p-16 text-center text-neutral-500">
          <svg className="w-12 h-12 text-neutral-600 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.07 6.07 0 00-1-3.59M9 17v1a3 3 0 11-6 0v-1m6 0H3m9 0a9 9 0 0118 0v1.5a.5.5 0 01-.5.5h-29a.5.5 0 01-.5-.5V17m5-8V7a4 4 0 118 0v2m-8 0h8" />
          </svg>
          <p className="text-base font-semibold">Inbox empty</p>
          <p className="text-xs text-neutral-600 mt-1">There are no matching notifications or alerts in your log.</p>
        </div>
      ) : (
        /* Logs List */
        <div className="bg-[#15191f] border border-[#232a35] rounded-2xl overflow-hidden shadow-md divide-y divide-[#232a35]">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleMarkAsRead(notif.id)}
              className={`flex items-start justify-between gap-4 p-4.5 transition-colors cursor-pointer hover:bg-[#1c222b] ${
                !notif.is_read ? "bg-[#181d24]" : "opacity-60"
              }`}
            >
              <div className="flex gap-4">
                {/* Icon wrapper */}
                <div className="relative shrink-0">
                  {getNotificationIcon(notif.type)}
                  {/* Unread indicator dot */}
                  {!notif.is_read && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border-2 border-[#15191f] rounded-full" />
                  )}
                </div>

                {/* Msg text */}
                <div className="space-y-1">
                  <p className={`text-sm text-neutral-200 ${!notif.is_read ? "font-bold text-white" : ""}`}>
                    {notif.message}
                  </p>
                  <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">{notif.type}</span>
                </div>
              </div>

              {/* Timestamp */}
              <span className="text-[11px] text-neutral-500 font-bold whitespace-nowrap pt-1">
                {getRelativeTime(notif.created_at)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
