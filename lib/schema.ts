import { z } from "zod";

export const extractRequestSchema = z.object({
  text: z.string().trim().min(1),
  anonymousSessionId: z.string().uuid().optional(),
  client: z
    .object({
      shortcutVersion: z.string().trim().min(1).max(32).optional(),
      inputSource: z.enum(["share-sheet", "clipboard", "manual"]).optional(),
    })
    .optional(),
  options: z
    .object({
      preferUnwatermarked: z.boolean().optional(),
      preferHighestQuality: z.boolean().optional(),
    })
    .optional(),
});
