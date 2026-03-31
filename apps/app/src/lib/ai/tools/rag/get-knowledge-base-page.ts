import { assetPointSelectSchema } from "@orcai/schema";
import { tool } from "ai";
import * as Effect from "effect/Effect";
import z from "zod/v4";
import { runtime } from "@/lib/effect/runtime";
import { AiError } from "@/lib/effect/utils/errors";
import { client } from "@/lib/orpc/orpc";
import {
	baseBlockSelectSchema,
	type DatabaseBlock,
} from "@/lib/orpc/schemas/block";
import type { ChunkResult, KnowledgeBaseDocument } from "./types";
import {
	compareByPageAssetChunk,
	flattenBlockResponses,
	loadDocumentCatalog,
	mergeAndSortCandidates,
	rankDocumentsByQuery,
	resolveSearchBlocks,
	toChunkResult,
} from "./utils";

export const getKnowledgeBasePageTool = ({
	blocks,
}: {
	blocks: DatabaseBlock[];
}) =>
	tool({
		description:
			"Retrieve chunks from a specific page (or nearby pages) in selected knowledge base documents.",
		inputSchema: z.object({
			page: z.coerce
				.number()
				.int()
				.min(1)
				.describe("1-based page number to retrieve."),
			blockId: baseBlockSelectSchema.shape.id.optional(),
			assetId: assetPointSelectSchema.shape.id
				.optional()
				.describe("Optional specific document asset id."),
			documentQuery: z
				.string()
				.optional()
				.describe("Optional document title query to match one or more assets."),
			includeAdjacentPages: z.coerce.number().int().min(0).max(2).default(0),
			limit: z.coerce.number().int().min(1).max(30).default(12),
		}),
		execute: async ({
			page,
			blockId,
			assetId,
			documentQuery,
			includeAdjacentPages,
			limit,
		}) =>
			runtime.runPromise(
				Effect.gen(function* () {
					const targetBlocks = resolveSearchBlocks({
						blocks,
						blockId,
					});
					if (targetBlocks.length === 0) {
						return {
							result: [] as ChunkResult[],
							matchedDocuments: [] as KnowledgeBaseDocument[],
						};
					}

					const documents = yield* loadDocumentCatalog({
						blocks: targetBlocks,
					});

					let matchedDocuments: KnowledgeBaseDocument[] = documents;
					if (assetId) {
						matchedDocuments = matchedDocuments.filter(
							(document) => document.assetId === assetId,
						);
					}

					if (documentQuery) {
						matchedDocuments = rankDocumentsByQuery({
							documents: matchedDocuments,
							query: documentQuery,
						});
					}

					const matchedAssetIds = Array.from(
						new Set(matchedDocuments.map((document) => document.assetId)),
					);

					if (matchedAssetIds.length === 0) {
						return {
							result: [] as ChunkResult[],
							matchedDocuments: [] as KnowledgeBaseDocument[],
						};
					}

					const normalizedRequestedPage = Math.max(1, page);
					const zeroBasedPage = normalizedRequestedPage - 1;
					const pageFrom = Math.max(0, zeroBasedPage - includeAdjacentPages);
					const pageTo = zeroBasedPage + includeAdjacentPages;
					const queryLimit = Math.max(limit * 4, 40);

					const blockResponses = yield* Effect.tryPromise({
						try: () =>
							Promise.all(
								targetBlocks.map(async (block) => {
									const response = await client.assetPoint.list({
										filters: {
											blockId: block.id,
											assetIds: matchedAssetIds,
											pageFrom,
											pageTo,
											limit: queryLimit,
										},
									});

									return {
										block,
										response,
									};
								}),
							),
						catch: (cause) =>
							new AiError({
								operation: "getKnowledgeBasePageTool.query",
								cause,
							}),
					});

					const points = mergeAndSortCandidates(
						flattenBlockResponses(blockResponses),
					)
						.sort(compareByPageAssetChunk)
						.slice(0, limit);

					return {
						result: points.map(toChunkResult),
						matchedDocuments: matchedDocuments.slice(0, 20),
						stats: {
							page: normalizedRequestedPage,
							pageFrom: pageFrom + 1,
							pageTo: pageTo + 1,
							returnedCount: Math.min(limit, points.length),
						},
					};
				}),
			),
	});
