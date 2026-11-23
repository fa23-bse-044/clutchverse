"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useLocale } from "@/i18n/locale-context";

export function FeatureFlagsLink() {
  const { messages } = useLocale();
  return (
    <Link href="/admin/features" className="panel">
      <span>
        <strong>{messages.matchLobby.featureFlags}</strong>
        <small>{messages.matchLobby.title}</small>
      </span>
      <ArrowUpRight size={15} aria-hidden="true" />
    </Link>
  );
}
