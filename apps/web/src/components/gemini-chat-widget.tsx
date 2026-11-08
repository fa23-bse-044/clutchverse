"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Bot, MessageCircle, Plus, Send, Trash2, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { useLocale } from "@/i18n/locale-context";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  sources?: { title: string; url: string }[];
};

type ConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
};

export function GeminiChatWidget() {
  const { status } = useSession();
  const { messages: catalog } = useLocale();
  const text = catalog.chat;
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const messagesRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    if (status !== "authenticated") return;
    let active = true;
    void fetch("/api/chat")
      .then(async (response) => {
        const result = (await response.json()) as {
          conversations?: ConversationSummary[];
          error?: string;
        };
        if (!response.ok)
          throw new Error(result.error ?? "Chat is unavailable.");
        if (active) setConversations(result.conversations ?? []);
      })
      .catch((loadError: unknown) => {
        if (active)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Conversation history is unavailable.",
          );
      });
    return () => {
      active = false;
    };
  }, [open, status]);

  useEffect(() => {
    messagesRef.current?.scrollTo({
      top: messagesRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function selectConversation(id: string) {
    if (!id) {
      setConversationId(null);
      setMessages([]);
      setError("");
      return;
    }
    setError("");
    try {
      const response = await fetch(`/api/chat/conversations/${id}`);
      const result = (await response.json()) as {
        conversation?: { id: string; messages: ChatMessage[] };
        error?: string;
      };
      if (!response.ok)
        throw new Error(result.error ?? "Unable to load this conversation.");
      setConversationId(result.conversation?.id ?? null);
      setMessages(result.conversation?.messages ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load this conversation.",
      );
    }
  }

  async function deleteConversation() {
    if (!conversationId) return;
    setError("");
    try {
      const response = await fetch(
        `/api/chat/conversations/${conversationId}`,
        {
          method: "DELETE",
        },
      );
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error ?? "Unable to delete conversation.");
      setConversations((current) =>
        current.filter((conversation) => conversation.id !== conversationId),
      );
      setConversationId(null);
      setMessages([]);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete conversation.",
      );
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || busy) return;
    setDraft("");
    setError("");
    setBusy(true);
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    setMessages((current) => [
      ...current,
      { role: "user", content: message },
      { role: "assistant", content: "" },
    ]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, conversationId }),
        signal: abortController.signal,
      });
      const newConversationId = response.headers.get("x-chat-conversation-id");
      if (newConversationId) setConversationId(newConversationId);
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? "The assistant could not respond.");
      }
      if (!response.body) throw new Error("The streaming response was empty.");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((current) => {
          const updated = [...current];
          const last = updated.at(-1);
          if (last?.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              content: last.content + chunk,
            };
          }
          return updated;
        });
      }
      const remaining = decoder.decode();
      if (remaining) {
        setMessages((current) => {
          const updated = [...current];
          const last = updated.at(-1);
          if (last?.role === "assistant") {
            updated[updated.length - 1] = {
              ...last,
              content: last.content + remaining,
            };
          }
          setMessages((current) => {
            const updated = [...current];
            const last = updated.at(-1);
            if (last?.role !== "assistant") return current;
            const marker = "\n\n__CLUTCHVERSE_SOURCES__";
            const markerIndex = last.content.indexOf(marker);
            if (markerIndex < 0) return current;
            let sources: ChatMessage["sources"] = [];
            try {
              const parsed: unknown = JSON.parse(last.content.slice(markerIndex + marker.length));
              if (Array.isArray(parsed)) {
                sources = parsed.flatMap((source) => {
                  if (
                    typeof source !== "object" ||
                    source === null ||
                    !("url" in source) ||
                    typeof source.url !== "string"
                  ) return [];
                  try {
                    const url = new URL(source.url);
                    if (url.protocol !== "https:") return [];
                    return [{
                      title:
                        "title" in source && typeof source.title === "string"
                          ? source.title
                          : url.hostname,
                      url: url.href,
                    }];
                  } catch {
                    return [];
                  }
                });
              }
            } catch {
              setError("Some source links could not be displayed.");
            }
            updated[updated.length - 1] = {
              ...last,
              content: last.content.slice(0, markerIndex).trimEnd(),
              sources,
            };
            return updated;
          });
          return updated;
        });
      }
      const refreshed = await fetch("/api/chat");
      if (refreshed.ok) {
        const result = (await refreshed.json()) as {
          conversations?: ConversationSummary[];
        };
        setConversations(result.conversations ?? []);
      }
    } catch (sendError) {
      if (sendError instanceof DOMException && sendError.name === "AbortError") {
        setMessages((current) =>
          current.at(-1)?.content ? current : current.slice(0, -1),
        );
        return;
      }
      setMessages((current) =>
        current.at(-1)?.content ? current : current.slice(0, -1),
      );
      setError(
        sendError instanceof Error
          ? sendError.message
          : "The assistant could not respond. Please try again.",
      );
    } finally {
      abortControllerRef.current = null;
      setBusy(false);
    }
  }

  function stopResponse() {
    abortControllerRef.current?.abort();
  }

  return (
    <div className="gemini-chat">
      {open && (
        <section
          className="gemini-chat-panel panel"
          aria-label={text.title}
          aria-live="polite"
        >
          <header className="gemini-chat-header">
            <div className="gemini-chat-title">
              <span className="gemini-chat-icon">
                <Bot size={17} />
              </span>
              <span>
                <strong>{text.title}</strong>
                <small>{text.subtitle}</small>
              </span>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label={text.close}
              onClick={() => setOpen(false)}
            >
              <X size={17} />
            </button>
            {busy && (
              <button
                className="gemini-chat-stop"
                type="button"
                onClick={stopResponse}
              >
                Stop
              </button>
            )}
          </header>

          {status === "loading" ? (
            <p className="gemini-chat-signin" role="status">
              {text.loading}
            </p>
          ) : status !== "authenticated" ? (
            <div className="gemini-chat-signin">
              <MessageCircle size={22} />
              <p>{text.signInPrompt}</p>
              <Link className="button button-primary" href="/login">
                {text.signIn}
              </Link>
            </div>
          ) : (
            <>
              <div className="gemini-chat-toolbar">
                <label className="sr-only" htmlFor="gemini-conversation">
                  {text.history}
                </label>
                <select
                  id="gemini-conversation"
                  value={conversationId ?? ""}
                  disabled={busy}
                  onChange={(event) =>
                    void selectConversation(event.target.value)
                  }
                >
                  <option value="">{text.newConversation}</option>
                  {conversations.map((conversation) => (
                    <option key={conversation.id} value={conversation.id}>
                      {conversation.title.slice(0, 58)}
                    </option>
                  ))}
                </select>
                <button
                  className="icon-button"
                  type="button"
                  aria-label={text.newConversation}
                  title={text.newConversation}
                  disabled={busy}
                  onClick={() => void selectConversation("")}
                >
                  <Plus size={16} />
                </button>
                <button
                  className="icon-button"
                  type="button"
                  aria-label={text.deleteConversation}
                  title={text.deleteConversation}
                  disabled={!conversationId || busy}
                  onClick={() => void deleteConversation()}
                >
                  <Trash2 size={15} />
                </button>
              </div>
              <div
                className="gemini-chat-messages"
                ref={messagesRef}
                role="log"
                aria-live="polite"
              >
                {messages.length === 0 && (
                  <p className="gemini-chat-empty">{text.empty}</p>
                )}
                {messages.map((entry, index) => (
                  <article
                    className={`gemini-message ${entry.role === "user" ? "gemini-message-user" : ""}`}
                    key={`${index}-${entry.role}`}
                  >
                    <strong>
                      {entry.role === "user" ? text.you : text.title}
                    </strong>
                    <p>{entry.content || (busy ? "AI is typing…" : "")}</p>
                    {entry.sources && entry.sources.length > 0 && (
                      <div className="gemini-chat-sources" aria-label="Sources">
                        {entry.sources.map((source) => (
                          <a
                            href={source.url}
                            key={source.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {source.title}
                          </a>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
              </div>
              {error && (
                <p className="gemini-chat-error" role="alert">
                  {error}
                </p>
              )}
              <form
                className="gemini-chat-compose"
                onSubmit={(event) => void sendMessage(event)}
              >
                <label className="sr-only" htmlFor="gemini-message">
                  {text.ask}
                </label>
                <textarea
                  id="gemini-message"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={text.placeholder}
                  maxLength={1000}
                  rows={2}
                  disabled={busy}
                  required
                />
                <button
                  className="gemini-chat-send"
                  type="submit"
                  aria-label={text.send}
                  disabled={busy || !draft.trim()}
                >
                  <Send size={16} />
                </button>
              </form>
            </>
          )}
        </section>
      )}
      <button
        className="gemini-chat-launcher"
        type="button"
        aria-label={open ? text.close : text.title}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X size={20} /> : <MessageCircle size={20} />}
        <span>{text.title}</span>
      </button>
    </div>
  );
}
