import { AuthForm } from "@/components/auth-form";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  const providers = { google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET), discord: Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) };
  return <section className="section auth-page"><div className="auth-card panel"><div className="eyebrow">WELCOME BACK, PLAYER</div><h1>Enter the verse.</h1><p className="muted">Pick up where your last match left off.</p><AuthForm mode="login" providers={providers} /></div></section>;
}
