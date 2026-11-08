import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@clutchverse/db";
import { SettingsPanel } from "@/components/settings-panel";

export const metadata = { title: "Player settings" };

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/settings");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, theme: true, locale: true },
  });
  if (!user) redirect("/login");
  return (
    <section className="section page-top">
      <div className="container narrow-page">
        <div className="eyebrow">YOUR ACCOUNT</div>
        <h1 className="page-title">Player settings.</h1>
        <p className="page-intro">
          Control your appearance, language, and motion preferences.
        </p>
        <div className="account-summary panel">
          <span className="profile-avatar">
            {user.name?.slice(0, 1) ?? "P"}
          </span>
          <span>
            <strong>{user.name ?? "Player"}</strong>
            <small>{user.email}</small>
          </span>
          <span className="tag">{user.locale.toUpperCase()}</span>
        </div>
        <SettingsPanel theme={user.theme} />
      </div>
    </section>
  );
}
