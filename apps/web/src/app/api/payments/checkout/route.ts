import { randomUUID } from "node:crypto";
import Stripe from "stripe";
import { NextResponse } from "next/server";
import { z } from "zod";
import { DemoPaymentAdapter } from "@clutchverse/core";
import { prisma } from "@clutchverse/db";
import { auth } from "@/auth";

export const runtime = "nodejs";

const checkoutSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("store_item"), sku: z.enum(["neon-card", "season-pass", "badge-set"]) }),
  z.object({ kind: z.literal("tournament_entry"), tournamentId: z.string().min(1).max(64) }),
]);

const storeItems = {
  "neon-card": { name: "Neon Circuit player card", amount: 499 },
  "season-pass": { name: "ClutchVerse season pass", amount: 999 },
  "badge-set": { name: "Ranked ladder badge set", amount: 299 },
} as const;

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const input = await request.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Checkout details are invalid." }, { status: 400 });

  let amount: number;
  let description: string;
  let targetId: string;
  if (parsed.data.kind === "store_item") {
    const item = storeItems[parsed.data.sku];
    amount = item.amount;
    description = item.name;
    targetId = parsed.data.sku;
  } else {
    const tournament = await prisma.tournament.findUnique({
      where: { id: parsed.data.tournamentId },
      select: { id: true, title: true, entryFee: true, state: true, startsAt: true },
    });
    if (!tournament || tournament.entryFee <= 0 || tournament.state !== "UPCOMING" || tournament.startsAt <= new Date()) {
      return NextResponse.json({ error: "This tournament does not have an active entry fee." }, { status: 422 });
    }
    amount = tournament.entryFee;
    description = `${tournament.title} entry fee`;
    targetId = tournament.id;
  }

  const mode = process.env.PAYMENT_MODE ?? "disabled";
  if (mode === "disabled") {
    return NextResponse.json({ error: "Payments are disabled until PAYMENT_MODE is configured." }, { status: 503 });
  }
  if (mode === "demo" && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Demo payments are not allowed in production." }, { status: 503 });
  }
  if (mode !== "stripe" && mode !== "demo") {
    return NextResponse.json({ error: "Unsupported payment mode." }, { status: 503 });
  }

  let paymentId = "";
  try {
    const payment = await prisma.$transaction(async (transaction) => {
      const created = await transaction.payment.create({
        data: {
          userId: session.user.id,
          kind: parsed.data.kind,
          amount,
          currency: "USD",
          provider: mode,
          status: "pending",
          targetId,
        },
      });
      await transaction.auditLog.create({
        data: { actorId: session.user.id, action: "payment.checkout.create", targetType: "payment", targetId: created.id },
      });
      return created;
    });
    paymentId = payment.id;
    if (mode === "demo") {
      const demo = await new DemoPaymentAdapter().createCheckout({
        userId: session.user.id,
        amount,
        currency: payment.currency,
        description,
      });
      await prisma.payment.update({ where: { id: payment.id }, data: { externalId: demo.reference } });
      return NextResponse.json({ paymentId: payment.id, status: "pending_demo", charged: false }, { status: 201 });
    }
    if (!process.env.STRIPE_SECRET_KEY || !process.env.AUTH_URL) {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "failed" } });
      return NextResponse.json({ error: "Stripe or AUTH_URL is not configured." }, { status: 503 });
    }
    const base = new URL(process.env.AUTH_URL);
    if (process.env.NODE_ENV === "production" && base.protocol !== "https:") {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: "failed" } });
      return NextResponse.json({ error: "Production checkout requires an HTTPS AUTH_URL." }, { status: 503 });
    }
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amount,
          product_data: { name: description },
        },
      }],
      success_url: new URL("/store?checkout=success", base).toString(),
      cancel_url: new URL("/store?checkout=cancelled", base).toString(),
      client_reference_id: payment.id,
      metadata: { paymentId: payment.id, userId: session.user.id, targetId },
    });
    await prisma.payment.update({
      where: { id: payment.id },
      data: { provider: "stripe", externalId: checkout.id },
    });
    return NextResponse.json({ paymentId: payment.id, checkoutUrl: checkout.url }, { status: 201 });
  } catch (error) {
    if (paymentId) {
      await prisma.payment.update({ where: { id: paymentId }, data: { status: "failed", externalId: `failed_${randomUUID()}` } });
    }
    console.error("Payment checkout creation failed.", error);
    return NextResponse.json({ error: "Unable to start checkout." }, { status: 502 });
  }
}
