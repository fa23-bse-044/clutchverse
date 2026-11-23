import { z } from "zod";

export const spotlightEventSchema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  event: z.enum([
    "team:added",
    "team:updated",
    "team:removed",
    "counts:updated",
    "standings:updated",
    "match:updated",
    "status:changed",
  ]),
  payload: z.record(z.unknown()),
  updatedAt: z.string().datetime(),
});

export type SpotlightEventMessage = z.infer<typeof spotlightEventSchema>;

export function dispatchSpotlightEvent(
  message: SpotlightEventMessage,
  emit: (room: string, event: SpotlightEventMessage["event"], payload: Record<string, unknown>) => void,
): void {
  emit(`spotlight:${message.slug}`, message.event, {
    slug: message.slug,
    ...message.payload,
    updatedAt: message.updatedAt,
  });
}
