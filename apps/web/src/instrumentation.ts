export async function register() {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.NEXT_PHASE === "phase-production-build"
  )
    return;

  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret || secret.trim().length < 32) {
    throw new Error(
      "Auth.js requires AUTH_SECRET (or NEXTAUTH_SECRET) with at least 32 characters. Generate one with `openssl rand -base64 32` before starting the web app.",
    );
  }
}
