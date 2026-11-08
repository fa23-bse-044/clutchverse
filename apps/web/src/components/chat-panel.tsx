"use client";

import { type FormEvent, useState } from "react";
import { Send, Smile } from "lucide-react";
import { io, type Socket } from "socket.io-client";
import { useEffect, useRef } from "react";

type Message = { id?: string; name: string; body: string; time: string; color: string; reactions?: Record<string, number> };
const initialMessages: Message[] = [
  { name: "NOVA丨Rex", body: "That last rotation was unreal 🔥", time: "now", color: "violet" },
  { name: "MØON", body: "GGs all around. Next lobby in 5?", time: "1m", color: "orange" },
  { name: "Vex", body: "Anyone running the open bracket tonight?", time: "2m", color: "blue" },
  { name: "Sable", body: "Just registered — see you there 🤝", time: "3m", color: "green" },
];
const restricted = ["slur", "kill yourself", "dox"];

export function ChatPanel({ room }: { room: string }) {
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [notice, setNotice] = useState("");
  const [lastSent, setLastSent] = useState(0);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let active = true;
    void fetch(`/api/chat/${encodeURIComponent(room)}/messages`)
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json() as { messages?: { id: string; body: string; createdAt: string; author: { name: string | null } }[] };
        if (active && data.messages?.length) {
          setMessages(data.messages.map((message) => ({
            id: message.id,
            name: message.author.name ?? "Player",
            body: message.body,
            time: new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            color: "blue",
          })));
        }
      })
      .catch(() => {
        if (active) setNotice("Persistent chat history is unavailable; showing a local preview.");
      });

    void fetch("/api/realtime-token")
      .then(async (response) => {
        if (!response.ok) return null;
        const data = await response.json() as { token?: string };
        return data.token ?? null;
      })
      .then((token) => {
        if (!active || !token) return;
        const socket = io(process.env.NEXT_PUBLIC_REALTIME_URL ?? "http://localhost:4001", { auth: { token }, transports: ["websocket", "polling"] });
        socketRef.current = socket;
        socket.on("connect", () => {
          setConnected(false);
          socket.emit(
            "room:join",
            { roomId: room },
            (result: { ok?: boolean; error?: string }) => {
              if (!result?.ok) {
                setNotice(result?.error ?? "Unable to join this chat room.");
                return;
              }
              setConnected(true);
              setNotice("");
            },
          );
        });
        socket.on("disconnect", () => setConnected(false));
        socket.on("connect_error", () => setConnected(false));
        socket.on("chat:message", (message: { id: string; body: string; createdAt: string; author: { name: string | null }; roomId: string }) => {
          if (message.roomId !== room) return;
          setMessages((items) => [...items, {
            id: message.id,
            name: message.author.name ?? "Player",
            body: message.body,
            time: new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            color: "blue",
          }].slice(-50));
        });
        socket.on("chat:reaction", (event: { roomId: string; messageId: string; reactions: Record<string, number> }) => {
          if (event.roomId !== room) return;
          setMessages((items) => items.map((item) => item.id === event.messageId ? { ...item, reactions: event.reactions } : item));
        });
      })
      .catch(() => {
        if (active) setConnected(false);
      });

    return () => {
      active = false;
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [room]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const clean = body.trim();
    if (!clean) return;
    if (Date.now() - lastSent < 1500) {
      setNotice("Slow down a moment before sending another message.");
      return;
    }
    if (clean.length > 300) {
      setNotice("Messages must be 300 characters or fewer.");
      return;
    }
    if (restricted.some((word) => clean.toLowerCase().includes(word))) {
      setNotice("Your message was blocked by the community safety filter.");
      return;
    }
    if (connected && socketRef.current) {
      socketRef.current.emit("chat:send", { roomId: room, body: clean }, (result: { error?: string }) => {
        if (result?.error) setNotice(result.error);
      });
    } else {
      setMessages((items) => [...items, { name: "You (local preview)", body: clean, time: "now", color: "violet" }].slice(-30));
      setNotice("Sent to this local preview.");
    }
    setLastSent(Date.now());
    setBody("");
  };
  const react = (message: Message, emoji: string) => {
    if (!message.id) return;
    if (connected && socketRef.current) {
      socketRef.current.emit("chat:react", { roomId: room, messageId: message.id, emoji }, (result: { error?: string }) => {
        if (result?.error) setNotice(result.error);
      });
      return;
    }
    setMessages((items) => items.map((item) => item.id === message.id
      ? { ...item, reactions: { ...item.reactions, [emoji]: (item.reactions?.[emoji] ?? 0) + 1 } }
      : item));
  };
  return <div className="chat-panel panel" aria-label={`${room} chat`}>
    <div className="chat-panel-head"><div><span className={connected ? "live-dot" : "chat-offline-dot"} /><strong>COMMUNITY CHAT</strong></div><span className="muted">{connected ? "Connected" : "Preview mode"}</span></div>
    <div className="chat-messages" aria-live="polite">{messages.map((message, index) => <div className="chat-message" key={message.id ?? `${message.name}-${index}`}><span className={`chat-avatar ${message.color}`}>{message.name.slice(0, 1)}</span><div><div className="chat-message-meta"><strong>{message.name}</strong><time>{message.time}</time></div><p>{message.body}</p>{message.id && <div className="chat-reactions">{["🔥", "😂", "💯"].map((emoji) => <button key={emoji} aria-label={`React ${emoji}`} onClick={() => react(message, emoji)}>{emoji} {message.reactions?.[emoji] ?? ""}</button>)}</div>}</div></div>)}</div>
    <form className="chat-compose" onSubmit={submit}><button type="button" className="chat-emoji" aria-label="Emoji picker" onClick={() => setBody(`${body} ✨`)}><Smile size={17} /></button><input value={body} onChange={(event) => setBody(event.target.value)} placeholder="Say something good..." aria-label="Message" maxLength={300} /><button className="chat-send" aria-label="Send message" type="submit"><Send size={16} /></button></form>
    {notice && <span className="chat-notice" role="status">{notice}</span>}
    <div className="chat-demo-note">{connected ? "Authenticated realtime room · persistent history" : "Preview chat · sign in and configure the realtime server for shared messages"}</div>
  </div>;
}
