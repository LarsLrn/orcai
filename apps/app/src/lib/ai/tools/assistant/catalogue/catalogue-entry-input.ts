import { blockIdSchema, botIdSchema } from "@orcai/schema";
import { z } from "zod/v4";

/** A catalogue entry as the tools take it. */
export const catalogueEntryInputSchema = z
	.discriminatedUnion("resourceType", [
		z.strictObject({
			resourceType: z.literal("bot"),
			resourceId: botIdSchema,
		}),
		z.strictObject({
			resourceType: z.literal("block"),
			resourceId: blockIdSchema,
		}),
	])
	.describe(
		'The entry from findCatalogue: resourceType "bot" with a bot id, or "block" with a template or repository id.',
	);
