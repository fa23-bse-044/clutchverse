import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Join ClutchVerse" };

export default function RegisterPage() {
  const providers = { google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), discord: Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) };
  return <section className="section auth-page"><div className="auth-card panel"><div className="eyebrow">YOUR NEXT ROUND STARTS HERE</div><h1>Create your player account.</h1><p className="muted">One account for your profile, teams, events, and rankings.</p><AuthForm mode="register" providers={providers} /></div></section>;
}
