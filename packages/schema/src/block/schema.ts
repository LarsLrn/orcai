import { z } from "zod/v4";
import { assetIdSchema } from "../asset/ref";
import { entityCapabilitiesSchema } from "../authorization";
import type { ErrorReason } from "../shared/error-reason";
import { pipelineFailureSchema } from "../shared/primitives/pipeline-status";
import { publicationStatusSchema } from "../shared/primitives/publication-status";
import { retrievalModeSchema } from "../shared/primitives/retrieval-mode";
import { userIdSchema } from "../user/ref";
import { blockIdSchema } from "./ref";

export const contentJsonSchema = z.custom<object>(
	(value) =>
		value !== null && typeof value === "object" && !Array.isArray(value),
);

export const blockTypeSchema = z.enum([
	"template",
	"database",
]);

export const referencesConfigSchema = z
	.object({
		minReferences: z.number().int().min(1),
		maxReferences: z.number().int().min(1),
		defaultReferences: z.number().int().min(1),
	})
	.check((ctx) => {
		if (ctx.value.maxReferences < ctx.value.minReferences) {
			ctx.issues.push({
				code: "custom",
				params: {
					reason: "REFERENCE_RANGE_INVALID" satisfies ErrorReason,
				},
				path: [
					"maxReferences",
				],
				input: ctx.value,
			});
		}
		if (
			ctx.value.defaultReferences < ctx.value.minReferences ||
			ctx.value.defaultReferences > ctx.value.maxReferences
		) {
			ctx.issues.push({
				code: "custom",
				params: {
					reason: "DEFAULT_REFERENCES_OUT_OF_RANGE" satisfies ErrorReason,
				},
				path: [
					"defaultReferences",
				],
				input: ctx.value,
			});
		}
	});

export const templateBlockSchema = z.object({
	type: z.literal("template"),
	config: z.object({
		systemPrompt: z.string(),
	}),
});

export const databaseBlockSchema = z.object({
	type: z.literal("database"),
	config: z.object({
		...referencesConfigSchema.shape,
		scoreThreshold: z.number().min(0).max(1).optional(),
		retrievalMode: retrievalModeSchema.optional(),
		candidateLimit: z.number().int().min(1).max(200).optional(),
		maxPerAsset: z.number().int().min(1).optional(),
	}),
});

/** The retrieval settings a new repository starts with. */
export const defaultDatabaseBlockConfig = {
	minReferences: 1,
	maxReferences: 8,
	defaultReferences: 4,
	retrievalMode: "hybrid",
	scoreThreshold: 0.2,
	candidateLimit: 40,
	maxPerAsset: 6,
} as const satisfies z.infer<typeof databaseBlockSchema.shape.config>;

export const blockFieldsSchema = z.object({
	name: z.string(),
	description: z.string().max(500).nullable(),
	contentJson: contentJsonSchema.nullable(),
	contentHtml: z.string().nullable(),
	status: publicationStatusSchema,
	forkedFromId: blockIdSchema.nullable(),
	version: z.number().int(),
});

export const blockMutableFieldsSchema = blockFieldsSchema.partial();

const blockBaseSchema = blockFieldsSchema.extend({
	id: blockIdSchema,
	type: blockTypeSchema,
	config: z.unknown(),
	userId: userIdSchema,
	createdAt: z.coerce.date().nullable(),
	updatedAt: z.coerce.date().nullable(),
});

export const blockSchema = z.discriminatedUnion("type", [
	blockBaseSchema.extend(templateBlockSchema.shape),
	blockBaseSchema.extend(databaseBlockSchema.shape),
]);

export const blockWithCapabilitiesSchema = z.intersection(
	blockSchema,
	z.object({
		capabilities: entityCapabilitiesSchema,
	}),
);

export type Block = z.infer<typeof blockSchema>;
export type BlockWithCapabilities = z.infer<typeof blockWithCapabilitiesSchema>;

export type BlockConfigType =
	| z.infer<typeof templateBlockSchema.shape.config>
	| z.infer<typeof databaseBlockSchema.shape.config>;

export type BlockType = z.infer<typeof blockTypeSchema>;

export type TemplateBlock = Extract<
	Block,
	{
		type: "template";
	}
>;
export type DatabaseBlock = Extract<
	Block,
	{
		type: "database";
	}
>;

export function isTemplateBlock(block: Block): block is TemplateBlock {
	return block.type === "template";
}

export function isDatabaseBlock(block: Block): block is DatabaseBlock {
	return block.type === "database";
}

/** How far one document in a repository is from being searchable. */
export const documentStateSchema = z.enum([
	"queued",
	"processing",
	"indexing",
	"ready",
	"failed",
]);

export const documentReadinessSchema = z.object({
	assetId: assetIdSchema,
	title: z.string(),
	state: documentStateSchema,
	/** Set when `state` is failed: the stage that failed and why. */
	failure: z
		.object({
			stage: z.enum([
				"processing",
				"indexing",
			]),
			kind: pipelineFailureSchema,
		})
		.nullable(),
});

export const repositoryReadinessSchema = z.object({
	blockId: blockIdSchema,
	name: z.string(),
	capabilities: entityCapabilitiesSchema,
	totals: z.object({
		total: z.number().int(),
		ready: z.number().int(),
		/** Queued, processing or indexing. */
		preparing: z.number().int(),
		failed: z.number().int(),
	}),
	documents: z.array(documentReadinessSchema),
});

export type DocumentState = z.infer<typeof documentStateSchema>;
export type DocumentReadiness = z.infer<typeof documentReadinessSchema>;
export type RepositoryReadiness = z.infer<typeof repositoryReadinessSchema>;
