"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";
import type { FaqCategory } from "@/i18n/types";

const categoryOrder: FaqCategory[] = [
  "account",
  "tournaments",
  "payments",
  "streaming",
  "fairPlay",
  "technical",
];

export function FaqExplorer() {
  const { messages } = useLocale();
  const faq = messages.faq;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FaqCategory | "all">("all");
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const questions = useMemo(
    () =>
      faq.questions.filter(
        ([questionCategory, question, answer]) =>
          (category === "all" || category === questionCategory) &&
          (!normalizedQuery ||
            `${question} ${answer}`
              .toLocaleLowerCase()
              .includes(normalizedQuery)),
      ),
    [category, faq.questions, normalizedQuery],
  );
  const visibleCategories =
    category === "all"
      ? categoryOrder
      : categoryOrder.filter((item) => item === category);

  return (
    <div className="container faq-page">
      <header className="faq-heading">
        <span className="eyebrow">CLUTCHVERSE SUPPORT</span>
        <h1 className="page-title">{faq.title}</h1>
        <p className="page-intro">{faq.intro}</p>
        <label className="faq-search panel">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">{faq.search}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={faq.search}
            aria-label={faq.search}
          />
        </label>
      </header>

      <div className="faq-categories" aria-label={faq.all}>
        <button
          type="button"
          className={`faq-category${category === "all" ? " faq-category-active" : ""}`}
          aria-pressed={category === "all"}
          onClick={() => setCategory("all")}
        >
          {faq.all}
        </button>
        {categoryOrder.map((item) => (
          <button
            type="button"
            key={item}
            className={`faq-category${category === item ? " faq-category-active" : ""}`}
            aria-pressed={category === item}
            onClick={() => setCategory(item)}
          >
            {faq.categories[item]}
          </button>
        ))}
      </div>

      <div className="faq-groups">
        {visibleCategories.map((item) => {
          const entries = questions.filter(
            ([questionCategory]) => questionCategory === item,
          );
          if (entries.length === 0) return null;
          return (
            <section className="faq-group" key={item}>
              <h2>{faq.categories[item]}</h2>
              <div className="faq-questions panel">
                {entries.map(([, question, answer]) => (
                  <details className="faq-item" key={question}>
                    <summary>{question}</summary>
                    <p>{answer}</p>
                  </details>
                ))}
              </div>
            </section>
          );
        })}
        {questions.length === 0 && (
          <p className="empty-panel panel" role="status">
            {faq.empty}
          </p>
        )}
      </div>
    </div>
  );
}
