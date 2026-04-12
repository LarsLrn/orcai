import { tool } from "ai";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { runtime } from "@/lib/effect/runtime";
import { AiError } from "@/lib/effect/utils/errors";
import { client } from "@/lib/orpc/orpc";
import {
	baseBlockSelectSchema,
	type DatabaseBlock,
} from "@/lib/orpc/schemas/block";
import { RETRIEVAL_LIMITS } from "@/settings/constants";
import type { ChunkResult, PointWithBlock } from "./types";
import {
	flattenBlockResponses,
	mergeAndSortCandidates,
	resolveSearchBlocks,
	selectByIds,
	toChunkResult,
	toSearchKey,
	withSourceBlock,
} from "./utils";

export const getKnowledgeBaseChunksTool = ({
	blocks,
}: {
	blocks: DatabaseBlock[];
}) =>
	tool({
		description:
			"Read the full text of selected chunk IDs from prior search results. Use this after searchKnowledgeBase when you need exact evidence for the final answer.",
		inputSchema: z.object({
			ids: z
				.array(z.string())
				.max(20)
				.default([])
				.describe(
					"Chunk IDs from searchKnowledgeBase.results[].id. Prefer only the few IDs you actually need.",
				),
			limit: z.coerce
				.number()
				.int()
				.min(1)
				.max(RETRIEVAL_LIMITS.maxFullChunkFetches)
				.optional()
				.describe(
					"Optional cap on returned chunks after adjacent chunks are added. Default is enough to cover the requested IDs and any included neighbors.",
				),
			blockId: baseBlockSelectSchema.shape.id
				.optional()
				.describe(
					"Optional block ID when all chunk IDs come from one known block.",
				),
			includeAdjacent: z.coerce
				.number()
				.int()
				.min(0)
				.max(2)
				.default(0)
				.describe(
					"Include previous and next chunks around each requested chunk for local context.",
				),
		}),
		execute: async ({ ids, limit, blockId, includeAdjacent }) =>
			runtime.runPromise(
				Effect.gen(function* () {
					if (blocks.length === 0) {
						return yield* new AiError({
							operation: "getKnowledgeBaseChunksTool",
							cause: new Error("No database blocks configured for this bot."),
						});
					}

					const targetBlocks = resolveSearchBlocks({
						blocks,
						blockId,
					});
					const uniqueIds = Array.from(new Set(ids));
					const resolvedLimit = Math.min(
						RETRIEVAL_LIMITS.maxFullChunkFetches,
						limit ??
							Math.max(
								uniqueIds.length,
								uniqueIds.length * (includeAdjacent * 2 + 1),
							),
					);
					if (uniqueIds.length === 0) {
						return {
							chunks: [] as ChunkResult[],
							noNewEvidence: true,
							nextAction: "searchKnowledgeBase" as const,
							missingIds: [] as string[],
							stopReason: "missing_ids" as const,
							stats: {
								requestedChunkCount: 0,
								returnedChunkCount: 0,
								includeAdjacent,
								truncated: false,
							},
						};
					}
					if (targetBlocks.length === 0) {
						return {
							chunks: [] as ChunkResult[],
							noNewEvidence: true,
							nextAction: "refineSearch" as const,
						};
					}

					const blockResponses = yield* Effect.tryPromise({
						try: () =>
							Promise.all(
								targetBlocks.map(async (block) => {
									const response = await client.assetPoint.list({
										filters: {
											pointIds: uniqueIds,
											blockId: block.id,
											limit: uniqueIds.length,
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
								operation: "getKnowledgeBaseChunksTool.fetch",
								cause,
							}),
					});

					const candidates = mergeAndSortCandidates(
						flattenBlockResponses(blockResponses),
					);

					const orderedCandidates = selectByIds({
						candidates,
						ids: uniqueIds,
					});

					const adjacentByCandidateKey = new Map<string, PointWithBlock[]>();
					if (includeAdjacent > 0 && orderedCandidates.length > 0) {
						const adjacentResponses = yield* Effect.tryPromise({
							try: () =>
								Promise.all(
									orderedCandidates.map(async (candidate) => {
										const neighboringChunkIndexes = [];
										for (
											let offset = 1;
											offset <= includeAdjacent;
											offset += 1
										) {
											const previous = candidate.payload.chunk_index - offset;
											const next = candidate.payload.chunk_index + offset;
											if (previous >= 0) neighboringChunkIndexes.push(previous);
											neighboringChunkIndexes.push(next);
										}

										if (neighboringChunkIndexes.length === 0) {
											return {
												candidate,
												points: [] as PointWithBlock[],
											};
										}

										const response = await client.assetPoint.list({
											filters: {
												blockId: candidate.sourceBlock.id,
												assetIds: [
													candidate.payload.asset_id,
												],
												chunkIndices: neighboringChunkIndexes,
												limit: neighboringChunkIndexes.length,
											},
										});

										const points = withSourceBlock({
											sourceBlockId: candidate.sourceBlock.id,
											sourceBlockName: candidate.sourceBlock.name,
											points: response.data,
										})
											.filter(
												(point) =>
													point.id !== candidate.id &&
													point.payload.source === candidate.payload.source,
											)
											.sort((a, b) => {
												const distanceA = Math.abs(
													a.payload.chunk_index - candidate.payload.chunk_index,
												);
												const distanceB = Math.abs(
													b.payload.chunk_index - candidate.payload.chunk_index,
												);
												if (distanceA !== distanceB)
													return distanceA - distanceB;
												return a.payload.chunk_index - b.payload.chunk_index;
											});

										return {
											candidate,
											points,
										};
									}),
								),
							catch: (cause) =>
								new AiError({
									operation: "getKnowledgeBaseChunksTool.adjacent",
									cause,
								}),
						});

						for (const adjacentResult of adjacentResponses) {
							adjacentByCandidateKey.set(
								toSearchKey(adjacentResult.candidate),
								adjacentResult.points,
							);
						}
					}

					const candidateQueue: PointWithBlock[] = [];
					const queuedKeys = new Set<string>();
					for (const candidate of orderedCandidates) {
						const baseKey = toSearchKey(candidate);
						if (!queuedKeys.has(baseKey)) {
							candidateQueue.push(candidate);
							queuedKeys.add(baseKey);
						}

						const adjacentCandidates =
							adjacentByCandidateKey.get(baseKey) ?? [];
						for (const adjacentCandidate of adjacentCandidates) {
							const adjacentKey = toSearchKey(adjacentCandidate);
							if (queuedKeys.has(adjacentKey)) continue;
							candidateQueue.push(adjacentCandidate);
							queuedKeys.add(adjacentKey);
						}
					}

					const results: ChunkResult[] = [];

					for (const candidate of candidateQueue) {
						if (results.length >= resolvedLimit) {
							break;
						}

						results.push(toChunkResult(candidate));
					}

					const returnedIds = new Set(results.map((result) => result.id));
					const missingIds = uniqueIds.filter((id) => !returnedIds.has(id));
					const stopReason = missingIds.length > 0 ? "missing_ids" : "complete";

					return {
						chunks: results,
						noNewEvidence: results.length === 0,
						nextAction:
							results.length > 0
								? ("answerFromChunks" as const)
								: ("refineSearch" as const),
						missingIds,
						stopReason,
						stats: {
							requestedChunkCount: uniqueIds.length,
							returnedChunkCount: results.length,
							includeAdjacent,
							truncated: candidateQueue.length > results.length,
						},
					};
				}),
			),
	});
