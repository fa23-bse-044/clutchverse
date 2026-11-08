import { games } from "@clutchverse/core";
import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ games });
}
