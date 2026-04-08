import { z } from "zod";

export const extractRequestSchema = z.object({
  text: z.string().trim().min(1),
  options: z
    .object({
      preferUnwatermarked: z.boolean().optional(),
      preferHighestQuality: z.boolean().optional(),
    })
    .optional(),
});
