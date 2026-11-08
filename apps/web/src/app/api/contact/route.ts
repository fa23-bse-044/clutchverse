import { NextResponse } from "next/server";
import { prisma } from "@clutchverse/db";
import { sendContactNotification } from "@/lib/contact-email";
import { contactSchema } from "@/lib/contact-validation";
import { checkRateLimit, getRequestAddress } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const address = getRequestAddress(request);
  const rate = await checkRateLimit(`contact:${address}`, 5, 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many messages. Please try again shortly." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      },
    );
  }

  const input = await request.json().catch(() => null);
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Please check the contact form and try again." },
      { status: 400 },
    );

  let saved: { id: string };
  try {
    saved = await prisma.contactMessage.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email.toLowerCase(),
        topic: parsed.data.topic,
        message: parsed.data.message,
      },
      select: { id: true },
    });
  } catch (error) {
    console.error("Contact message could not be stored.", error);
    return NextResponse.json(
      { error: "We could not save your message. Please try again later." },
      { status: 503 },
    );
  }

  try {
    const delivery = await sendContactNotification(parsed.data);
    await prisma.contactMessage.update({
      where: { id: saved.id },
      data: { deliveryStatus: delivery },
    });
    return NextResponse.json(
      {
        message: "Your message has been received.",
        emailDelivery: delivery,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Contact notification delivery failed.", {
      messageId: saved.id,
      error,
    });
    await prisma.contactMessage.update({
      where: { id: saved.id },
      data: { deliveryStatus: "failed" },
    });
    return NextResponse.json(
      {
        message:
          "Your message was saved, but email notification could not be delivered.",
        emailDelivery: "failed",
      },
      { status: 201 },
    );
  }
}
