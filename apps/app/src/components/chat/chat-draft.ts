import { branchChatResponseSchema } from "@orcai/schema";
import type { z } from "zod/v4";

/** Text and attachments that prefill the composer of a freshly branched chat. */
export const chatDraftSchema = branchChatResponseSchema.shape.draft.unwrap();

export type ChatDraft = z.infer<typeof chatDraftSchema>;
