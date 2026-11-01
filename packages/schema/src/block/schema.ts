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
	"behaviour",
	"repository",
]);

export const passagesConfigSchema = z
	.object({
		minPassages: z.number().int().min(1),
		maxPassages: z.number().int().min(1),
		defaultPassages: z.number().int().min(1),
	})
	.check((ctx) => {
		if (ctx.value.maxPassages < ctx.value.minPassages) {
			ctx.issues.push({
				code: "custom",
				params: {
					reason: "PASSAGE_RANGE_INVALID" satisfies ErrorReason,
				},
				path: [
					"maxPassages",
				],
				input: ctx.value,
			});
		}
		if (
			ctx.value.defaultPassages < ctx.value.minPassages ||
			ctx.value.defaultPassages > ctx.value.maxPassages
		) {
			ctx.issues.push({
				code: "custom",
				params: {
					reason: "DEFAULT_PASSAGES_OUT_OF_RANGE" satisfies ErrorReason,
				},
				path: [
					"defaultPassages",
				],
				input: ctx.value,
			});
		}
	});

export const behaviourSchema = z.object({
	type: z.literal("behaviour"),
	config: z.object({
		systemPrompt: z.string(),
	}),
});

export const repositorySchema = z.object({
	type: z.literal("repository"),
	config: z.object({
		...passagesConfigSchema.shape,
		scoreThreshold: z.number().min(0).max(1).optional(),
		retrievalMode: retrievalModeSchema.optional(),
		candidateLimit: z.number().int().min(1).max(200).optional(),
		maxPerAsset: z.number().int().min(1).optional(),
	}),
});

/** The retrieval settings a new repository starts with. */
export const defaultRepositoryConfig = {
	minPassages: 1,
	maxPassages: 8,
	defaultPassages: 4,
	retrievalMode: "hybrid",
	scoreThreshold: 0.2,
	candidateLimit: 40,
	maxPerAsset: 6,
} as const satisfies z.infer<typeof repositorySchema.shape.config>;

export const blockFieldsSchema = z.object({
	name: z.string(),
	description: z.string().max(500).nullable(),
	contentJson: contentJsonSchema.nullable(),
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
	blockBaseSchema.extend(behaviourSchema.shape),
	blockBaseSchema.extend(repositorySchema.shape),
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
	| z.infer<typeof behaviourSchema.shape.config>
	| z.infer<typeof repositorySchema.shape.config>;

export type BlockType = z.infer<typeof blockTypeSchema>;

export type Behaviour = Extract<
	Block,
	{
		type: "behaviour";
	}
>;
export type Repository = Extract<
	Block,
	{
		type: "repository";
	}
>;

export function isBehaviour(block: Block): block is Behaviour {
	return block.type === "behaviour";
}

export function isRepository(block: Block): block is Repository {
	return block.type === "repository";
}

/** How far one asset in a repository is from being searchable. */
export const assetStateSchema = z.enum([
	"queued",
	"processing",
	"indexing",
	"ready",
	"failed",
]);

export const assetReadinessSchema = z.object({
	assetId: assetIdSchema,
	title: z.string(),
	state: assetStateSchema,
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

export const repositoryTotalsSchema = z.object({
	total: z.number().int(),
	ready: z.number().int(),
	/** Queued, processing or indexing. */
	preparing: z.number().int(),
	failed: z.number().int(),
});

export const repositoryReadinessSchema = z.object({
	blockId: blockIdSchema,
	name: z.string(),
	capabilities: entityCapabilitiesSchema,
	totals: repositoryTotalsSchema,
	assets: z.array(assetReadinessSchema),
});

export type AssetState = z.infer<typeof assetStateSchema>;
export type AssetReadiness = z.infer<typeof assetReadinessSchema>;
export type RepositoryReadiness = z.infer<typeof repositoryReadinessSchema>;
export type RepositoryTotals = z.infer<typeof repositoryTotalsSchema>;
