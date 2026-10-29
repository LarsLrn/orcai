import { z } from "zod/v4";
import { assetIdSchema } from "../asset/ref";
import { botIdSchema } from "../bot/ref";
import { paginationInputSchema, zedTokenSchema } from "../shared";
import { searchFilterSchema } from "../shared/filters";
import {
	libraryScopeSchema,
	librarySortSchema,
	publicationStatusFilterSchema,
} from "../shared/library";
import { createUniqueRefsInputSchema } from "../shared/ref-list";
import { blockIdSchema } from "./ref";
import {
	blockFieldsSchema,
	blockTypeSchema,
	contentJsonSchema,
	databaseBlockSchema,
	templateBlockSchema,
} from "./schema";

const blockWriteFieldsSchema = blockFieldsSchema.extend({
	name: z.string().min(1),
	description: blockFieldsSchema.shape.description.optional(),
	contentJson: contentJsonSchema.nullable().optional(),
	contentHtml: blockFieldsSchema.shape.contentHtml.optional(),
	forkedFromId: blockFieldsSchema.shape.forkedFromId.optional(),
	version: blockFieldsSchema.shape.version.optional(),
});

export const createTemplateBlockInputSchema = blockWriteFieldsSchema.extend(
	templateBlockSchema.shape,
);

export const createDatabaseBlockInputSchema = blockWriteFieldsSchema.extend({
	...databaseBlockSchema.shape,
	assets: z.array(assetIdSchema).default([]),
});

export const createBlockInputSchema = z.discriminatedUnion("type", [
	createTemplateBlockInputSchema,
	createDatabaseBlockInputSchema,
]);

const updateBlockFieldsSchema = blockWriteFieldsSchema.extend({
	id: blockIdSchema,
});

export const updateTemplateBlockInputSchema = updateBlockFieldsSchema.extend(
	templateBlockSchema.shape,
);

export const updateDatabaseBlockInputSchema = updateBlockFieldsSchema.extend({
	...databaseBlockSchema.shape,
	assets: z.array(assetIdSchema).default([]),
});

export const updateBlockInputSchema = z.discriminatedUnion("type", [
	updateTemplateBlockInputSchema,
	updateDatabaseBlockInputSchema,
]);

export const listBlocksInputSchema = paginationInputSchema.extend({
	...zedTokenSchema.shape,
	filters: z
		.object({
			/**
			 * The bot's blocks, readable with the bot instead of from the
			 * library: `status` then only filters their rows, and `scope` is
			 * refused.
			 */
			botId: botIdSchema.optional(),
			type: blockTypeSchema.optional(),
			/** Published blocks unless given. */
			status: publicationStatusFilterSchema.optional(),
			scope: libraryScopeSchema.optional(),
			...searchFilterSchema.shape,
		})
		.refine((filters) => !(filters.botId && filters.scope), {
			message: "A bot's blocks have no scope",
			path: [
				"scope",
			],
		})
		.optional(),
	sort: librarySortSchema.default("newest"),
});

export const findBlockInputSchema = z.object({
	id: blockIdSchema,
	...zedTokenSchema.shape,
});

export const deleteBlocksInputSchema = z.object({
	refs: createUniqueRefsInputSchema({
		key: "id",
		value: blockIdSchema,
	}),
});

/** How many repositories one `block.readiness` call takes. */
export const BLOCK_READINESS_MAX_IDS = 100;

export const blockReadinessInputSchema = z.object({
	blockIds: z.array(blockIdSchema).max(BLOCK_READINESS_MAX_IDS),
	...zedTokenSchema.shape,
});

export const retryDocumentInputSchema = z.object({
	blockId: blockIdSchema,
	assetId: assetIdSchema,
});

export const retryFailedDocumentsInputSchema = z.object({
	blockId: blockIdSchema,
});

export type ListBlocksInput = z.infer<typeof listBlocksInputSchema>;
export type CreateBlockInput = z.infer<typeof createBlockInputSchema>;
export type FindBlockInput = z.infer<typeof findBlockInputSchema>;
export type UpdateBlockInput = z.infer<typeof updateBlockInputSchema>;
export type DeleteBlocksInput = z.infer<typeof deleteBlocksInputSchema>;
export type BlockReadinessInput = z.infer<typeof blockReadinessInputSchema>;
export type RetryDocumentInput = z.infer<typeof retryDocumentInputSchema>;
export type RetryFailedDocumentsInput = z.infer<
	typeof retryFailedDocumentsInputSchema
>;
