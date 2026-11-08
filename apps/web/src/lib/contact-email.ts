type ContactEmail = {
  name: string;
  email: string;
  topic: string;
  message: string;
};

export type ContactDelivery = "sent" | "development-mock";

export async function sendContactNotification(
  submission: ContactEmail,
): Promise<ContactDelivery> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return "development-mock";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? "ClutchVerse <hello@example.com>",
      to: [process.env.CONTACT_TO_EMAIL ?? "hello@clutchverse.gg"],
      reply_to: submission.email,
      subject: `ClutchVerse contact: ${submission.topic}`,
      text: [
        `From: ${submission.name}`,
        `Email: ${submission.email}`,
        `Topic: ${submission.topic}`,
        "",
        submission.message,
      ].join("\n"),
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok)
    throw new Error(`Contact email provider returned ${response.status}.`);
  return "sent";
}
