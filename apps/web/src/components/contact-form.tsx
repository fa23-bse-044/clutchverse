"use client";

import { useState } from "react";
import type { FormEvent } from "react";

export function ContactForm() {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback("");
    setError(false);
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = (await response.json()) as {
        message?: string;
        error?: string;
        emailDelivery?: string;
      };
      if (!response.ok)
        throw new Error(result.error ?? "Unable to send message.");
      setFeedback(
        result.emailDelivery === "failed"
          ? "Your message was saved, but the team notification failed. We will follow up."
          : (result.message ?? "Your message has been received."),
      );
      form.reset();
    } catch (submissionError) {
      setError(true);
      setFeedback(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to send message. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="contact-form panel" onSubmit={submit}>
      <label>
        Your name
        <input
          name="name"
          autoComplete="name"
          required
          minLength={2}
          maxLength={80}
        />
      </label>
      <label>
        Email address
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
        />
      </label>
      <label>
        Topic
        <select name="topic" defaultValue="general">
          <option value="general">General</option>
          <option value="privacy">Privacy</option>
          <option value="partnership">Partnership</option>
          <option value="accessibility">Accessibility</option>
        </select>
      </label>
      <label>
        Message
        <textarea
          name="message"
          required
          minLength={20}
          maxLength={3000}
          rows={6}
        />
      </label>
      <label className="contact-honeypot" aria-hidden="true">
        Leave this empty
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <button className="button button-primary" type="submit" disabled={busy}>
        {busy ? "Sending…" : "Send message"}
      </button>
      {feedback && (
        <p
          className={error ? "form-feedback form-error" : "form-feedback"}
          role="status"
        >
          {feedback}
        </p>
      )}
    </form>
  );
}
