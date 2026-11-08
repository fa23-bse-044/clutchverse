import Stripe from "stripe";
import { NextResponse } from "next/server";
import { prisma } from "@clutchverse/db";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !webhookSecret || !signature) {
    return NextResponse.json({ error: "Stripe webhook is not configured." }, { status: 503 });
  }
  const stripe = new Stripe(secret);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, webhookSecret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed.", error);
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }
  if (!["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed"].includes(event.type)) {
    return NextResponse.json({ received: true });
  }
  const checkout = event.data.object as Stripe.Checkout.Session;
  const paymentId = checkout.metadata?.paymentId ?? checkout.client_reference_id;
  if (!paymentId) return NextResponse.json({ error: "Payment reference is missing." }, { status: 400 });
  const status = event.type === "checkout.session.async_payment_failed" ? "failed" : checkout.payment_status === "paid" ? "paid" : "pending";
  try {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.externalId !== checkout.id) {
      return NextResponse.json({ error: "Payment record not found." }, { status: 404 });
    }
    if (payment.status !== "paid") {
      await prisma.$transaction(async (transaction) => {
        await transaction.payment.update({ where: { id: payment.id }, data: { status } });
        if (status === "paid") {
          await transaction.auditLog.create({
            data: {
              actorId: payment.userId,
              action: "payment.checkout.paid",
              targetType: "payment",
              targetId: payment.id,
            },
          });
        }
      });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing failed.", error);
    return NextResponse.json({ error: "Unable to process payment event." }, { status: 500 });
  }
}
