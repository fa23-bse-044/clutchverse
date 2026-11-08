import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "clutchverse-web",
    mode: process.env.NODE_ENV === "production" ? "production" : "development",
    timestamp: new Date().toISOString(),
  });
}
