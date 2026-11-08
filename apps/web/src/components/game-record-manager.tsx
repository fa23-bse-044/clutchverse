"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { games } from "@clutchverse/core";
import type { GameSlug } from "@clutchverse/core";

type GameRecord = {
  id: string;
  gameSlug: string;
  title: string;
  holder: string;
  value: string;
  achievedAt: string;
  proofUrl: string | null;
  verificationLabel: string;
};

type Fields = Omit<
  GameRecord,
  "id" | "proofUrl" | "verificationLabel" | "gameSlug"
> & {
  gameSlug: GameSlug;
  proofUrl: string;
};

const emptyFields: Fields = {
  gameSlug: "pubg-mobile",
  title: "",
  holder: "",
  value: "",
  achievedAt: "",
  proofUrl: "",
};

export function GameRecordManager({
  initialRecords,
}: {
  initialRecords: GameRecord[];
}) {
  const [records, setRecords] = useState(initialRecords);
  const [fields, setFields] = useState<Fields>(emptyFields);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const payload = {
        ...fields,
        achievedAt: new Date(fields.achievedAt).toISOString(),
      };
      const response = await fetch(
        editingId
          ? `/api/admin/game-records/${editingId}`
          : "/api/admin/game-records",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const result = (await response.json()) as {
        record?: GameRecord;
        error?: string;
      };
      if (!response.ok || !result.record)
        throw new Error(result.error ?? "Could not save this record.");
      const savedRecord = result.record;
      setRecords((current) =>
        editingId
          ? current.map((record) =>
              record.id === editingId ? savedRecord : record,
            )
          : [savedRecord, ...current],
      );
      setFields(emptyFields);
      setEditingId(null);
      setMessage("Community record saved.");
    } catch (saveError) {
      setMessage(
        saveError instanceof Error
          ? saveError.message
          : "Could not save this record.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(record: GameRecord) {
    if (!window.confirm(`Delete "${record.title}" for ${record.holder}?`))
      return;
    setMessage("");
    try {
      const response = await fetch(`/api/admin/game-records/${record.id}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(result.error ?? "Could not delete this record.");
      setRecords((current) => current.filter(({ id }) => id !== record.id));
      setMessage("Community record deleted.");
      if (editingId === record.id) {
        setEditingId(null);
        setFields(emptyFields);
      }
    } catch (deleteError) {
      setMessage(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete this record.",
      );
    }
  }

  return (
    <div className="game-record-admin">
      <form className="contact-form panel" onSubmit={submit}>
        <h2>{editingId ? "Edit community record" : "Add community record"}</h2>
        <label>
          Game
          <select
            value={fields.gameSlug}
            onChange={(event) => {
              const selectedGame = games.find(
                (game) => game.slug === event.target.value,
              );
              if (selectedGame)
                setFields({ ...fields, gameSlug: selectedGame.slug });
            }}
          >
            {games.map((game) => (
              <option value={game.slug} key={game.slug}>
                {game.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Record title
          <input
            required
            minLength={4}
            maxLength={120}
            value={fields.title}
            onChange={(event) =>
              setFields({ ...fields, title: event.target.value })
            }
          />
        </label>
        <label>
          Holder
          <input
            required
            minLength={2}
            maxLength={100}
            value={fields.holder}
            onChange={(event) =>
              setFields({ ...fields, holder: event.target.value })
            }
          />
        </label>
        <label>
          Value
          <input
            required
            maxLength={120}
            value={fields.value}
            onChange={(event) =>
              setFields({ ...fields, value: event.target.value })
            }
          />
        </label>
        <label>
          Date achieved
          <input
            required
            type="datetime-local"
            value={fields.achievedAt}
            onChange={(event) =>
              setFields({ ...fields, achievedAt: event.target.value })
            }
          />
        </label>
        <label>
          Proof link (HTTPS)
          <input
            type="url"
            value={fields.proofUrl}
            onChange={(event) =>
              setFields({ ...fields, proofUrl: event.target.value })
            }
          />
        </label>
        <div className="admin-record-actions">
          <button
            className="button button-primary"
            type="submit"
            disabled={busy}
          >
            {busy ? "Saving…" : editingId ? "Save changes" : "Create record"}
          </button>
          {editingId && (
            <button
              className="button"
              type="button"
              onClick={() => {
                setEditingId(null);
                setFields(emptyFields);
              }}
            >
              Cancel
            </button>
          )}
        </div>
        {message && (
          <p className="form-feedback" role="status">
            {message}
          </p>
        )}
      </form>

      <div className="game-record-admin-list">
        {records.map((record) => (
          <article className="panel game-record-admin-row" key={record.id}>
            <div>
              <span className="tag">
                {record.gameSlug} · {record.verificationLabel}
              </span>
              <h3>{record.title}</h3>
              <p>
                {record.holder} · {record.value}
              </p>
            </div>
            <div className="admin-record-actions">
              <button
                className="button"
                type="button"
                onClick={() => {
                  const gameSlug = games.find(
                    (game) => game.slug === record.gameSlug,
                  )?.slug;
                  if (!gameSlug) return;
                  setEditingId(record.id);
                  setFields({
                    gameSlug,
                    title: record.title,
                    holder: record.holder,
                    value: record.value,
                    achievedAt: record.achievedAt.slice(0, 16),
                    proofUrl: record.proofUrl ?? "",
                  });
                }}
              >
                Edit
              </button>
              <button
                className="button"
                type="button"
                onClick={() => void remove(record)}
              >
                Delete
              </button>
            </div>
          </article>
        ))}
        {!records.length && (
          <div className="empty-panel panel">
            No community records have been entered.
          </div>
        )}
      </div>
    </div>
  );
}
