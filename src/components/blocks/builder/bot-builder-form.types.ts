import type { z } from "zod";
import type { botInsertSchema } from "@/lib/orpc/schemas/bot";

export type BotBuilderFormValues = z.infer<typeof botInsertSchema>;
