import { z } from "zod/v4";
import { organizationIdSchema } from "../organization/ref";
import { userIdSchema } from "../user/ref";

const ownedCountsShape = {
	bots: z.number().int().nonnegative(),
	blocks: z.number().int().nonnegative(),
	assets: z.number().int().nonnegative(),
};

/** What changed hands: the receiver and how many bots, blocks and Library assets. */
export const handedOverSchema = z.object({
	receiverId: userIdSchema,
	...ownedCountsShape,
});

/** What users own in one organisation, and who would receive it by default. */
export const ownedContentSchema = z.object({
	organizationId: organizationIdSchema,
	organizationName: z.string(),
	...ownedCountsShape,
	defaultReceiverId: userIdSchema.nullable(),
});

/** A member who may receive content. */
export const contentReceiverSchema = z.object({
	id: userIdSchema,
	name: z.string(),
	email: z.string(),
	image: z.string().nullable(),
});

export type HandedOver = z.infer<typeof handedOverSchema>;
export type OwnedContent = z.infer<typeof ownedContentSchema>;
export type ContentReceiver = z.infer<typeof contentReceiverSchema>;
