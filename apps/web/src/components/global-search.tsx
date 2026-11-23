"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { games } from "@clutchverse/core";
import { useLocale } from "@/i18n/locale-context";

const groupOrder = [
  "games",
  "tournaments",
  "teams",
  "players",
  "news",
  "streams",
  "faqs",
  "records",
  "proScene",
] as const;
type GroupName = (typeof groupOrder)[number];
type SearchItem = {
  id: string;
  title: string;
  description: string;
  href: string;
  game?: string;
  source?: { name: string; url: string; fetchedAt?: string };
};
type SearchGroups = Record<GroupName, SearchItem[]>;
type SearchPayload = { query: string; groups: SearchGroups };
type SearchMode = "trigger" | "page";

const emptyGroups = (): SearchGroups => ({
  games: [],
  tournaments: [],
  teams: [],
  players: [],
  news: [],
  streams: [],
  faqs: [],
  records: [],
  proScene: [],
});

const recentStorageKey = "clutchverse-recent-searches";
const groupLabels: Record<GroupName, string> = {
  games: "Games",
  tournaments: "Tournaments",
  teams: "Teams",
  players: "Players",
  news: "News",
  streams: "Streams",
  faqs: "FAQs",
  records: "Records",
  proScene: "Pro Scene",
};

function saveRecentSearch(query: string) {
  const normalized = query.trim();
  if (!normalized) return;
  try {
    const stored = JSON.parse(localStorage.getItem(recentStorageKey) ?? "[]") as unknown;
    const searches = Array.isArray(stored)
      ? stored.filter((entry): entry is string => typeof entry === "string")
      : [];
    localStorage.setItem(
      recentStorageKey,
      JSON.stringify([normalized, ...searches.filter((entry) => entry !== normalized)].slice(0, 6)),
    );
  } catch (error) {
    console.warn("Could not save recent search.", error);
  }
}

export function GlobalSearch({ mode = "trigger" }: { mode?: SearchMode }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [game, setGame] = useState("");
  const [type, setType] = useState("");
  const [groups, setGroups] = useState<SearchGroups>(emptyGroups);
  const [recent, setRecent] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { messages } = useLocale();

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(recentStorageKey) ?? "[]") as unknown;
      if (Array.isArray(stored)) {
        setRecent(stored.filter((entry): entry is string => typeof entry === "string").slice(0, 6));
      }
    } catch (reason) {
      console.warn("Could not read recent searches.", reason);
    }
  }, []);

  useEffect(() => {
    if (mode !== "trigger") return;
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onShortcut);
    return () => window.removeEventListener("keydown", onShortcut);
  }, [mode]);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setGroups(emptyGroups());
      setLoading(false);
      setError("");
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ q: term });
      if (game) params.set("game", game);
      if (type) params.set("type", type);
      void fetch(`/api/search?${params}`, { signal: controller.signal })
        .then(async (response) => {
          if (!response.ok) {
            const body = (await response.json()) as { error?: string };
            throw new Error(body.error ?? "Search request failed.");
          }
          return (await response.json()) as SearchPayload;
        })
        .then((payload) => {
          setGroups(payload.groups);
          setActiveIndex(0);
        })
        .catch((reason: unknown) => {
          if (controller.signal.aborted) return;
          console.error("Global search request failed.", reason);
          setError(reason instanceof Error ? reason.message : "Search is unavailable.");
          setGroups(emptyGroups());
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [game, query, type]);

  const entries = useMemo(
    () => groupOrder.flatMap((name) => groups[name].map((item) => ({ name, item }))),
    [groups],
  );

  function navigateTo(item: SearchItem) {
    saveRecentSearch(query);
    setRecent((items) => [query.trim(), ...items.filter((entry) => entry !== query.trim())].slice(0, 6));
    if (mode === "trigger") setOpen(false);
    router.push(item.href);
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" && entries.length) {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % entries.length);
    } else if (event.key === "ArrowUp" && entries.length) {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + entries.length) % entries.length);
    } else if (event.key === "Enter" && entries[activeIndex]) {
      event.preventDefault();
      navigateTo(entries[activeIndex].item);
    } else if (event.key === "Escape" && mode === "trigger") {
      event.preventDefault();
      setOpen(false);
    }
  }

  const content = (
    <div className={mode === "page" ? "global-search-page" : "global-search-dialog"}>
      <div className="global-search-controls">
        <label className="global-search panel">
          <Search size={20} aria-hidden="true" />
          <input
            autoFocus={mode === "page" || open}
            role="combobox"
            aria-expanded={entries.length > 0}
            aria-controls="global-search-results"
            aria-autocomplete="list"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Games, players, tournaments, streams..."
            aria-label={messages.account.search}
          />
        </label>
        <label className="search-filter">
          <span>Game</span>
          <select value={game} onChange={(event) => setGame(event.target.value)}>
            <option value="">All games</option>
            {games.map((entry) => <option value={entry.slug} key={entry.slug}>{entry.name}</option>)}
          </select>
        </label>
        <label className="search-filter">
          <span>Type</span>
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">All types</option>
            {groupOrder.map((entry) => <option value={entry} key={entry}>{groupLabels[entry]}</option>)}
          </select>
        </label>
      </div>
      {!query.trim() && recent.length > 0 && (
        <div className="search-recent">
          <strong>Recent searches</strong>
          {recent.map((term) => (
            <button type="button" className="filter-chip" key={term} onClick={() => setQuery(term)}>
              {term}
            </button>
          ))}
        </div>
      )}
      {query.trim().length === 1 && <p className="muted search-prompt">Enter at least 2 characters.</p>}
      {loading && <p className="muted" role="status">Searching…</p>}
      {error && <p className="search-error" role="alert">{error}</p>}
      {!loading && query.trim().length >= 2 && !error && !entries.length && (
        <div className="empty-panel panel">No matches found. Try another spelling or filter.</div>
      )}
      {entries.length > 0 && (
        <div className="search-results" id="global-search-results" role="listbox" aria-label="Search results">
          {groupOrder.map((group) => groups[group].length > 0 && (
            <section key={group} aria-label={groupLabels[group]}>
              <h2>{groupLabels[group]} <span>{groups[group].length}</span></h2>
              {groups[group].map((item) => {
                const index = entries.findIndex((entry) => entry.item.id === item.id && entry.name === group);
                return (
                  <div
                    className={`search-result panel ${index === activeIndex ? "search-result-active" : ""}`}
                    key={item.id}
                    role="option"
                    aria-selected={index === activeIndex}
                    tabIndex={-1}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => navigateTo(item)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigateTo(item);
                      }
                    }}
                  >
                    <span className="search-result-icon" aria-hidden="true">{item.title.slice(0, 1)}</span>
                    <span className="search-result-copy">
                      <Link href={item.href} onClick={(event) => {
                        event.stopPropagation();
                        saveRecentSearch(query);
                        setRecent((items) => [query.trim(), ...items.filter((entry) => entry !== query.trim())].slice(0, 6));
                        if (mode === "trigger") setOpen(false);
                      }}>
                        <strong>{item.title}</strong>
                      </Link>
                      <small>{item.description}</small>
                      {item.source && (
                        <small className="search-attribution">
                          Source: <a href={item.source.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>{item.source.name}</a>
                          {item.source.fetchedAt && ` · updated ${new Date(item.source.fetchedAt).toLocaleString()}`}
                        </small>
                      )}
                    </span>
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      )}
    </div>
  );

  if (mode === "page") {
    return (
      <section className="section page-top">
        <div className="container">
          <div className="eyebrow">FIND YOUR NEXT MATCHUP</div>
          <h1 className="page-title">Search the verse.</h1>
          <p className="page-intro">Search games, tournaments, teams, players, streams, FAQs, and sourced Pro Scene data.</p>
          {content}
        </div>
      </section>
    );
  }

  return (
    <>
      <button
        className="icon-button search-button"
        type="button"
        aria-label={messages.account.search}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Search size={16} />
      </button>
      {open && (
        <div className="search-dialog-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <section className="search-dialog panel" role="dialog" aria-modal="true" aria-label={messages.account.search}>
            <div className="search-dialog-heading">
              <span>{messages.account.search}</span>
              <button className="icon-button" type="button" aria-label="Close search" onClick={() => setOpen(false)}><X size={16} /></button>
            </div>
            {content}
            <p className="search-shortcut-hint">Use ↑ ↓ to navigate · Enter to open · Esc to close</p>
          </section>
        </div>
      )}
    </>
  );
}
