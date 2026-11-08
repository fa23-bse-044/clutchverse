"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff } from "lucide-react";

export function AuthForm({ mode, providers }: { mode: "login" | "register"; providers: { google: boolean; discord: boolean } }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const register = mode === "register";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    if (register) {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, handle: formData.get("handle") }),
      });
      if (!response.ok) {
        const result = await response.json() as { error?: string };
        setError(result.error ?? "Unable to create your account.");
        setBusy(false);
        return;
      }
    }
    const result = await signIn("credentials", { email, password, redirect: false });
    setBusy(false);
    if (result?.error) {
      setError(register ? "Account created, but sign-in failed. Check your database and try signing in." : "Email or password is incorrect.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return <form className="auth-form" onSubmit={submit}>
    {register && <label>PLAYER HANDLE<input name="handle" placeholder="Your in-game name" minLength={3} maxLength={20} pattern="[a-zA-Z0-9_]{3,20}" autoComplete="nickname" required /></label>}
    <label>EMAIL ADDRESS<input name="email" type="email" placeholder="you@example.com" autoComplete="email" required /></label>
    <label>PASSWORD<div className="password-input"><input name="password" type={showPassword ? "text" : "password"} placeholder={register ? "12 characters minimum" : "Your password"} minLength={register ? 12 : 1} autoComplete={register ? "new-password" : "current-password"} required /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={15} /> : <Eye size={15} />}</button></div></label>
    {error && <p className="auth-error" role="alert">{error}</p>}
    <button className="button button-primary full-button auth-submit" disabled={busy}>{busy ? "PLEASE WAIT..." : register ? "CREATE PLAYER ACCOUNT" : "SIGN IN"} <ArrowRight size={15} /></button>
    {(providers.google || providers.discord) && <><div className="auth-divider"><span>OR</span></div><div className="oauth-buttons">
      {providers.google && <button type="button" className="button" onClick={() => void signIn("google", { callbackUrl: "/" })}>Continue with Google</button>}
      {providers.discord && <button type="button" className="button" onClick={() => void signIn("discord", { callbackUrl: "/" })}>Continue with Discord</button>}
    </div></>}
    <p className="auth-switch">{register ? "Already have an account?" : "New to the verse?"} <Link href={register ? "/login" : "/register"}>{register ? "Sign in" : "Create account"}</Link></p>
  </form>;
}
