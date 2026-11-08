import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  topic: z.enum(["general", "privacy", "partnership", "accessibility"]),
  message: z.string().trim().min(20).max(3000),
  website: z.string().max(0).optional(),
});
