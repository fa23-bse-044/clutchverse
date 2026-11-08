import type { Metadata } from "next";
import { cookies } from "next/headers";
import { FaqExplorer } from "./faq-explorer";
import { isLocale } from "@/i18n/locales";
import { messages } from "@/i18n/messages";

export const metadata: Metadata = {
  title: "Frequently asked questions",
  description:
    "Answers about ClutchVerse accounts, tournaments, payments, streams, fair play, and technical support.",
  alternates: { canonical: "/faq" },
};

export default async function FaqPage() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("clutchverse-locale")?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : "en";
  const faq = messages[locale].faq;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.questions.map(([, question, answer]) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answer },
    })),
  };

  return (
    <>
      <section className="section page-top">
        <FaqExplorer />
      </section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
        }}
      />
    </>
  );
}
