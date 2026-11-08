import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { NotificationCenter } from "@/components/notification-center";

export const metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/notifications");
  return <section className="section page-top"><div className="container narrow-page"><div className="eyebrow">YOUR PLAYER INBOX</div><h1 className="page-title">Notifications.</h1><p className="page-intro">Event reminders, match results, and account updates.</p><NotificationCenter /></div></section>;
}
