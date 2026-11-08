"use client";

import { useEffect, useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";

type Notification = {
  id: string;
  type: string;
  payload: unknown;
  readAt: string | null;
  createdAt: string;
};

export function NotificationCenter() {
  const [items, setItems] = useState<Notification[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    const response = await fetch("/api/notifications");
    const data = (await response.json()) as {
      notifications?: Notification[];
      error?: string;
    };
    if (!response.ok) setError(data.error ?? "Unable to load notifications.");
    else {
      setItems(data.notifications ?? []);
      setError("");
    }
    setLoading(false);
  };
  useEffect(() => {
    void load().catch((cause: unknown) => {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to load notifications.",
      );
      setLoading(false);
    });
  }, []);
  async function markRead(id?: string) {
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(id ? { id } : { all: true }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? "Unable to update notifications.");
      return;
    }
    setItems((current) =>
      current.map((item) =>
        !id || item.id === id
          ? { ...item, readAt: new Date().toISOString() }
          : item,
      ),
    );
  }
  async function respondToInvite(
    notification: Notification,
    inviteId: string,
    decision: "accept" | "decline",
  ) {
    const response = await fetch(
      `/api/team-invites/${encodeURIComponent(inviteId)}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decision }),
      },
    );
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? "Unable to update team invitation.");
      return;
    }
    await markRead(notification.id);
  }
  return (
    <div className="notification-center panel">
      <div className="notification-head">
        <span className="eyebrow">
          {items.filter((item) => !item.readAt).length} UNREAD
        </span>
        <button className="text-link" onClick={() => void markRead()}>
          <CheckCheck size={14} /> MARK ALL READ
        </button>
      </div>
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <div className="empty-panel">Loading notifications…</div>
      ) : items.length ? (
        items.map((item) => {
          const payload =
            typeof item.payload === "object" && item.payload !== null
              ? (item.payload as Record<string, unknown>)
              : {};
          return (
            <article
              className={`notification-item ${item.readAt ? "" : "notification-unread"}`}
              key={item.id}
            >
              <span className="notification-icon">
                <Bell size={15} />
              </span>
              <div>
                <strong>
                  {String(payload.title ?? item.type.replaceAll("_", " "))}
                </strong>
                <p>
                  {String(
                    payload.message ??
                      "You have a new update from ClutchVerse.",
                  )}
                </p>
                <time>{new Date(item.createdAt).toLocaleString()}</time>
                {item.type === "team_invite" &&
                  !item.readAt &&
                  typeof payload.inviteId === "string" && (
                    <div className="invite-actions">
                      <button
                        className="button button-primary"
                        onClick={() =>
                          void respondToInvite(
                            item,
                            payload.inviteId as string,
                            "accept",
                          )
                        }
                      >
                        Accept
                      </button>
                      <button
                        className="button"
                        onClick={() =>
                          void respondToInvite(
                            item,
                            payload.inviteId as string,
                            "decline",
                          )
                        }
                      >
                        Decline
                      </button>
                    </div>
                  )}
              </div>
              {!item.readAt && (
                <button
                  className="icon-button"
                  aria-label="Mark as read"
                  onClick={() => void markRead(item.id)}
                >
                  <Check size={14} />
                </button>
              )}
            </article>
          );
        })
      ) : (
        <div className="empty-panel">
          You’re all caught up. New event updates will show here.
        </div>
      )}
    </div>
  );
}
