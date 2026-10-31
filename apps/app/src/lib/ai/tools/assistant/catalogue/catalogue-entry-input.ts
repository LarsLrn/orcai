import {
	blockIdSchema,
	botIdSchema,
	type CatalogueEntryRef,
} from "@orcai/schema";
import { z } from "zod/v4";

/** A catalogue entry as the tools take it. */
export const catalogueEntryInputSchema = z
	.discriminatedUnion("targetType", [
		z.strictObject({
			targetType: z.literal("bot"),
			targetId: botIdSchema,
		}),
		z.strictObject({
			targetType: z.literal("block"),
			targetId: blockIdSchema,
		}),
	])
	.describe(
		'The entry from findCatalogue: targetType "bot" with a bot id, or "block" with a template or repository id.',
	);

export const toCatalogueEntry = (
	entry: z.infer<typeof catalogueEntryInputSchema>,
): CatalogueEntryRef =>
	entry.targetType === "bot"
		? {
				resourceType: "bot",
				resourceId: entry.targetId,
			}
		: {
				resourceType: "block",
				resourceId: entry.targetId,
			};
