import type { DatabaseBlock } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { effectTool } from "@/lib/ai/tools/assistant/procedure-tool";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { RETRIEVAL_LIMITS } from "@/settings/constants";
import { chunksModelOutput } from "./outputs";
import { neighbouringRuns } from "./passages";
import type { PointWithBlock } from "./types";
import { flattenBlockResponses, toPassage, withSourceBlock } from "./utils";

/** The chunk indexes within `neighbours` of `point`, without its own. */
const neighbourIndexes = (point: PointWithBlock, neighbours: number) =>
	Array.from(
		{
			length: neighbours * 2 + 1,
		},
		(_, offset) => point.payload.chunk_index - neighbours + offset,
	).filter(
		(index) =>
			index >= 0 &&
			index < point.payload.chunkCount &&
			index !== point.payload.chunk_index,
	);

export const getKnowledgeBaseChunksTool = ({
	blocks,
	context,
}: {
	blocks: DatabaseBlock[];
	context: ORPCContext;
}) =>
	effectTool({
		description:
			"Read the text around chunks from earlier results. Neighbouring chunks of one document come back as one passage.",
		inputSchema: z.object({
			chunks: z
				.array(z.string())
				.min(1)
				.max(RETRIEVAL_LIMITS.maxFullChunkFetches)
				.describe("Chunk ids from earlier results."),
			neighbours: z.coerce
				.number()
				.int()
				.min(0)
				.max(2)
				.default(1)
				.describe("Chunks to read before and after each chunk."),
		}),
		run: ({ chunks, neighbours }) =>
			Effect.gen(function* () {
				const procedures = yield* Procedures;
				const ids = Array.from(new Set(chunks));

				const found = flattenBlockResponses(
					yield* Effect.forEach(
						blocks,
						(block) =>
							procedures.assetPoint
								.searchRepository(
									{
										repositoryId: block.id,
										filters: {
											pointIds: ids,
											limit: ids.length,
										},
									},
									{
										context,
									},
								)
								.pipe(
									Effect.map((response) => ({
										block,
										response,
									})),
								),
						{
							concurrency: "unbounded",
						},
					),
				);
				const requested = ids.flatMap(
					(id) => found.find((point) => point.id === id) ?? [],
				);

				const documents = new Map<
					string,
					{
						point: PointWithBlock;
						indexes: Set<number>;
					}
				>();
				for (const point of requested) {
					const key = `${point.sourceBlock.id}:${point.payload.asset_id}:${point.payload.source}`;
					const document = documents.get(key) ?? {
						point,
						indexes: new Set<number>(),
					};
					for (const index of neighbourIndexes(point, neighbours)) {
						document.indexes.add(index);
					}
					documents.set(key, document);
				}

				const around = yield* Effect.forEach(
					[
						...documents.values(),
					].filter(({ indexes }) => indexes.size > 0),
					({ point, indexes }) =>
						procedures.assetPoint
							.searchRepository(
								{
									repositoryId: point.sourceBlock.id,
									filters: {
										assetIds: [
											point.payload.asset_id,
										],
										chunkIndices: [
											...indexes,
										],
										limit: indexes.size,
									},
								},
								{
									context,
								},
							)
							.pipe(
								Effect.map((response) =>
									withSourceBlock({
										sourceBlockId: point.sourceBlock.id,
										sourceBlockName: point.sourceBlock.name,
										points: response.data.filter(
											(neighbour) =>
												neighbour.payload.source === point.payload.source,
										),
									}),
								),
							),
					{
						concurrency: "unbounded",
					},
				);

				const passages = neighbouringRuns([
					...requested,
					...around.flat(),
				]).map(toPassage);
				const missing = ids.filter(
					(id) => !requested.some((point) => point.id === id),
				);

				return {
					passages,
					...(missing.length > 0 && {
						missing,
					}),
				};
			}),
		toModelOutput: chunksModelOutput,
	});
