import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function SectionTitle({
  label,
  title,
  action,
}: {
  label: string;
  title: string;
  action?: { href: string; text: string };
}) {
  return <div className="section-heading"><div><div className="eyebrow">{label}</div><h2>{title}</h2></div>{action && <Link className="text-link" href={action.href}>{action.text} <ArrowUpRight size={14} /></Link>}</div>;
}
