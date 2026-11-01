import type { DatabaseBlock } from "@orcai/schema";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import type { ChatSources } from "@/lib/ai/citations/chat-sources";
import { effectTool } from "@/lib/ai/tools/assistant/procedure-tool";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { RETRIEVAL_LIMITS } from "@/settings/constants";
import { passagesModelOutput } from "./outputs";
import { neighbouringRuns } from "./passages";
import type { PointWithBlock } from "./types";
import { flattenBlockResponses, toPassage, withRepository } from "./utils";

/** The passage indexes within `neighbours` of `point`, without its own. */
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

/** What Qdrant takes for a point id: a UUID or an unsigned integer. */
const POINT_ID =
	/^(?:[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}|\d+)$/i;

export const getPassagesTool = ({
	blocks,
	context,
	sources,
}: {
	blocks: DatabaseBlock[];
	context: ORPCContext;
	sources: ChatSources;
}) => {
	/** The point id a passage ref names, or the point id given; undefined for anything else. */
	const pointIdOf = (refOrId: string) =>
		(refOrId.startsWith("k") ? sources.identityOf(refOrId) : undefined) ??
		(POINT_ID.test(refOrId) ? refOrId : undefined);

	return effectTool({
		description:
			"Read the text around passages from earlier results, such as the rest of a list or an argument that breaks off. Passages next to each other in one asset come back joined as one passage. Use it only when you need that context, since searchRepositories already returns each passage in full.",
		inputSchema: z.strictObject({
			passages: z
				.array(z.string())
				.min(1)
				.max(RETRIEVAL_LIMITS.maxFullPassageFetches)
				.describe("Refs of passages from earlier results, such as kgol9ts."),
			neighbours: z.coerce
				.number()
				.int()
				.min(0)
				.max(2)
				.default(1)
				.describe("How many passages to read before and after each one."),
		}),
		run: ({ passages: refs, neighbours }) =>
			Effect.gen(function* () {
				const procedures = yield* Procedures;
				const ids = Array.from(
					new Set(refs.flatMap((ref) => pointIdOf(ref) ?? [])),
				);

				const found = flattenBlockResponses(
					yield* Effect.forEach(
						ids.length > 0 ? blocks : [],
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

				const assets = new Map<
					string,
					{
						point: PointWithBlock;
						indexes: Set<number>;
					}
				>();
				for (const point of requested) {
					const key = `${point.repository.id}:${point.payload.asset_id}:${point.payload.source}`;
					const asset = assets.get(key) ?? {
						point,
						indexes: new Set<number>(),
					};
					for (const index of neighbourIndexes(point, neighbours)) {
						asset.indexes.add(index);
					}
					assets.set(key, asset);
				}

				const around = yield* Effect.forEach(
					[
						...assets.values(),
					].filter(({ indexes }) => indexes.size > 0),
					({ point, indexes }) =>
						procedures.assetPoint
							.searchRepository(
								{
									repositoryId: point.repository.id,
									filters: {
										assetIds: [
											point.payload.asset_id,
										],
										passageIndices: [
											...indexes,
										],
										// Text and image passages of one asset share indexes.
										limit: indexes.size * 2,
									},
								},
								{
									context,
								},
							)
							.pipe(
								Effect.map((response) =>
									withRepository({
										repositoryId: point.repository.id,
										repositoryName: point.repository.name,
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
				]).map((run) =>
					toPassage(
						run,
						run.find((point) => requested.includes(point)),
					),
				);
				const missing = refs.filter(
					(ref) => !requested.some((point) => point.id === pointIdOf(ref)),
				);

				return {
					passages,
					...(missing.length > 0 && {
						missing,
					}),
				};
			}),
		toModelOutput: passagesModelOutput,
	});
};
