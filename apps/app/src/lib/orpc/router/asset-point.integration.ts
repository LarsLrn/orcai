import { afterAll, describe, expect, test } from "bun:test";
import { type AssetId, type BlockId, buckets } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	EmbeddingIndex,
	type EmbeddingIndexScope,
	upsertPointsToQdrant,
	writeGeneration,
} from "@orcai/qdrant";
import { testEmbeddingIndex } from "@orcai/qdrant/testing";
import {
	type AssetPoint,
	type assetPointsFiltersSchema,
	SEARCH_QUERIES_MAX,
	SEARCH_QUERY_MAX_LENGTH,
} from "@orcai/schema";
import { reasonOf } from "@orcai/testing";
import { serve } from "bun";
import { eq, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import type { z } from "zod/v4";
import { writeRelationships } from "@/lib/authz/relationship-write";
import { initializeResourceAuthorization } from "@/lib/authz/resource-lifecycle";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import {
	type Actor,
	appIntegration,
	onEmbeddingIndex,
	TIMEOUT,
} from "@/lib/testing/app-integration";

const { run, organizationWith, procedureOptions } = appIntegration();

const dimensions = 8;

/** A unit vector at cosine `similarity` to every query's embedding. */
const at = (similarity: number) =>
	Array.from(
		{
			length: dimensions,
		},
		(_, index) =>
			index === 0
				? similarity
				: index === 1
					? Math.sqrt(1 - similarity ** 2)
					: 0,
	);

/** Every value the endpoint below embedded. */
const embedded: string[] = [];

/** An OpenAI-compatible endpoint that embeds every query as the same vector. */
const embeddings = serve({
	port: 0,
	fetch: async (request) => {
		const { input } = (await request.json()) as {
			input: string[];
		};
		embedded.push(...input);
		return Response.json({
			object: "list",
			data: input.map((_, index) => ({
				object: "embedding",
				index,
				embedding: at(1),
			})),
			model: "integration",
			usage: {
				prompt_tokens: 1,
				total_tokens: 1,
			},
		});
	},
});

// E5 instruct models expect this before a query, line break included.
const QUERY_PREFIX =
	"Instruct: Given a question, retrieve passages that answer it\nQuery: ";

const configuredIndex = await testEmbeddingIndex({
	baseUrl: `${embeddings.url.origin}/v1`,
	model: "integration",
	dimensions,
	queryPrefix: QUERY_PREFIX,
	passagePrefix: "passage: ",
});
const unconfiguredIndex = await testEmbeddingIndex();

afterAll(() => embeddings.stop(true));

/** The actor's call options on `index`, whose queries the endpoint above embeds. */
const embeddingThroughEndpoint = async (
	actor: Actor,
	zedToken?: string,
	index: EmbeddingIndexScope = configuredIndex,
) => {
	return onEmbeddingIndex(await procedureOptions(actor, zedToken), index);
};

const STRONG = 0.8;
// Below the 0.5 threshold, above the relaxed pass's 0.28.
const WEAK = 0.4;
const UNRELATED = 0.1;

/**
 * A ready repository of assets whose passages lie at these similarities to
 * the query, in `organization`'s organisation and owned by its first actor,
 * or in a new one.
 */
const repositoryOf = async (
	passageSimilarities: number[][],
	organization?: Awaited<ReturnType<typeof organizationWith>>,
) => {
	const within =
		organization ??
		(await organizationWith([
			"member",
		]));
	const {
		organizationId,
		actors: [owner],
		zedToken,
	} = within;
	const assets = await run(
		writeRelationships(
			{
				organizationIds: [
					organizationId,
				],
			},
			Effect.forEach(passageSimilarities, () =>
				Effect.gen(function* () {
					const [asset] = yield* (yield* DB)
						.insert(dbSchema.asset)
						.values({
							title: "Integration asset",
							size: 1,
							fileType: "pdf",
							bucket: buckets.main.name,
							prefix: `users/${owner.user.id}/asset`,
							userId: owner.user.id,
						})
						.returning();
					yield* initializeResourceAuthorization({
						resource: {
							resourceType: "asset",
							resourceId: asset.id,
						},
						organizationId,
						ownerUserId: owner.user.id,
					});
					return asset.id;
				}),
			),
		),
	);
	const procedures = await run(Procedures);
	const block = await run(
		procedures.block.create(
			{
				type: "repository",
				name: "Integration repository",
				description: null,
				contentJson: null,
				status: "ready",
				assets: assets.result,
				config: {
					minPassages: 1,
					maxPassages: 5,
					defaultPassages: 3,
				},
			},
			await procedureOptions(owner, assets.zedToken ?? zedToken),
		),
	);
	const indexed = await completeLinks(block.data.id);
	await storePassages(
		block.data.id,
		assets.result,
		passageSimilarities,
		(assetId) => indexed.get(assetId) ?? 0,
	);

	const search = async (
		filters: z.infer<typeof assetPointsFiltersSchema>,
		index?: EmbeddingIndexScope,
	) =>
		run(
			procedures.assetPoint.searchRepository(
				{
					repositoryId: block.data.id,
					filters: {
						queries: [
							"refund",
						],
						retrievalMode: "dense",
						minScore: 0.5,
						maxPerAsset: 2,
						...filters,
					},
				},
				await embeddingThroughEndpoint(owner, block.meta?.zedToken, index),
			),
		);

	/** Searches of this repository, and of `others` the owner cannot read, in one request. */
	/** Searches in one request, of this repository unless one names another. */
	const searchMany = async (
		searches: (z.infer<typeof assetPointsFiltersSchema> & {
			repositoryId?: BlockId;
		})[],
	) =>
		run(
			procedures.assetPoint.searchRepositories(
				{
					searches: searches.map(
						({ repositoryId = block.data.id, ...filters }) => ({
							repositoryId,
							filters: {
								queries: [
									"refund",
								],
								retrievalMode: "dense" as const,
								minScore: 0.5,
								maxPerAsset: 2,
								...filters,
							},
						}),
					),
				},
				await embeddingThroughEndpoint(owner, block.meta?.zedToken),
			),
		);

	const browse = async (index?: EmbeddingIndexScope) =>
		run(
			procedures.assetPoint.browseRepository(
				{
					repositoryId: block.data.id,
				},
				await embeddingThroughEndpoint(owner, block.meta?.zedToken, index),
			),
		);

	return {
		organization: within,
		assets: assets.result,
		blockId: block.data.id,
		indexed,
		search,
		searchMany,
		browse,
	};
};

/** Each link's completed attempt, as the indexer leaves it. */
const completeLinks = (blockId: BlockId) =>
	run(
		Effect.gen(function* () {
			const links = yield* (yield* DB)
				.update(dbSchema.blockAsset)
				.set({
					indexStatus: "completed",
					indexedAttempt: sql`${dbSchema.blockAsset.indexAttempt}`,
				})
				.where(eq(dbSchema.blockAsset.blockId, blockId))
				.returning({
					assetId: dbSchema.blockAsset.assetId,
					attempt: dbSchema.blockAsset.indexAttempt,
				});
			return new Map(
				links.map((link) => [
					link.assetId,
					link.attempt,
				]),
			);
		}),
	);

/** Points of `passageSimilarities` at these similarities, written by `attempt` of each asset's link. */
const storePassages = (
	blockId: BlockId,
	assets: AssetId[],
	passageSimilarities: number[][],
	attempt: (assetId: AssetId) => number,
	published = true,
) =>
	run(
		writeGeneration(
			upsertPointsToQdrant({
				points: assets.flatMap((assetId, assetIndex) =>
					passageSimilarities[assetIndex].map((similarity, index, all) => ({
						id: crypto.randomUUID(),
						vector: at(similarity),
						payload: {
							source: "text" as const,
							asset_id: assetId,
							block_id: blockId,
							text: `Passage ${index} at ${similarity}`,
							depth: 0,
							tokens: 4,
							chunk_index: index,
							chunkCount: all.length,
							createdAt: new Date().toISOString(),
							index_attempt: attempt(assetId),
							published,
						},
					})),
				),
			}),
		).pipe(Effect.provideService(EmbeddingIndex, configuredIndex)),
	);

const perAsset = (points: AssetPoint[]) => {
	const counts: Record<string, number> = {};
	for (const point of points) {
		counts[point.payload.asset_id] = (counts[point.payload.asset_id] ?? 0) + 1;
	}
	return counts;
};

const passages = (count: number, similarity: number) =>
	Array.from(
		{
			length: count,
		},
		() => similarity,
	);

const similarities = (points: AssetPoint[]) =>
	points.map((point) => Number(point.payload.text.split(" at ")[1]));

describe("repository search", () => {
	test(
		"embeds each query after the query prefix, not the passage prefix",
		async () => {
			const { search } = await repositoryOf([
				passages(1, STRONG),
			]);
			const before = embedded.length;

			await search({
				queries: [
					"refund",
					"late fee",
				],
			});

			expect(embedded.slice(before)).toEqual([
				`${QUERY_PREFIX}refund`,
				`${QUERY_PREFIX}late fee`,
			]);
		},
		TIMEOUT,
	);

	test(
		"fills the limit from a single asset",
		async () => {
			const { search } = await repositoryOf([
				[
					...passages(12, STRONG),
					...passages(2, UNRELATED),
				],
			]);

			const { data } = await search({
				limit: 10,
			});

			expect(similarities(data)).toEqual(passages(10, STRONG));
		},
		TIMEOUT,
	);

	test(
		"backfills only with passages a recall pass admits, and leaves the rest of the slots empty",
		async () => {
			const { search } = await repositoryOf([
				[
					...passages(4, STRONG),
					WEAK,
					...passages(2, UNRELATED),
				],
			]);

			const { data, metadata } = await search({
				limit: 10,
			});

			expect(similarities(data)).toEqual([
				...passages(4, STRONG),
				WEAK,
			]);
			expect(metadata?.scoreThreshold).toBeCloseTo(0.28);
		},
		TIMEOUT,
	);

	test(
		"caps passages per asset when enough assets match",
		async () => {
			const { search, assets } = await repositoryOf([
				passages(4, STRONG),
				passages(4, STRONG),
				passages(4, STRONG),
			]);

			const { data } = await search({
				limit: 6,
			});

			expect(perAsset(data)).toEqual(
				Object.fromEntries(
					assets.map((assetId) => [
						assetId,
						2,
					]),
				),
			);
		},
		TIMEOUT,
	);

	test(
		"fills what the cap leaves from the asset with more matches",
		async () => {
			const { search, assets } = await repositoryOf([
				passages(8, STRONG),
				passages(1, STRONG),
			]);

			const { data } = await search({
				limit: 6,
			});

			expect(perAsset(data)).toEqual({
				[assets[0]]: 5,
				[assets[1]]: 1,
			});
		},
		TIMEOUT,
	);

	test(
		"a recall budget above the limit finds the assets a strong one would crowd out",
		async () => {
			const {
				search,
				assets: [strong, first, second],
			} = await repositoryOf([
				passages(12, STRONG),
				[
					WEAK,
				],
				[
					WEAK,
				],
			]);

			const atLimit = await search({
				limit: 6,
			});
			const withBudget = await search({
				limit: 6,
				recallLimit: 36,
			});

			expect(perAsset(atLimit.data)).toEqual({
				[strong]: 6,
			});
			expect(perAsset(withBudget.data)).toEqual({
				[strong]: 4,
				[first]: 1,
				[second]: 1,
			});
		},
		TIMEOUT,
	);
});

describe("searching several repositories", () => {
	/** Three repositories of one owner; the last was written last, so its token reads them all. */
	const siblings = async () => {
		const first = await repositoryOf([
			[
				...passages(3, STRONG),
				WEAK,
			],
			passages(2, STRONG),
		]);
		const second = await repositoryOf(
			[
				passages(2, STRONG),
			],
			first.organization,
		);
		const third = await repositoryOf(
			[
				[
					STRONG,
					WEAK,
				],
			],
			first.organization,
		);
		return [
			first,
			second,
			third,
		] as const;
	};

	const codeOf = (operation: Promise<unknown>) =>
		operation.then(
			() => undefined,
			(error: { code?: string }) => error.code,
		);

	test(
		"embeds the distinct queries of every dense or hybrid search in one request, each search ranked as alone",
		async () => {
			const repositories = await siblings();
			const searches = [
				{
					queries: [
						"refund",
						"late fee",
					],
					retrievalMode: "hybrid" as const,
				},
				{
					queries: [
						"zebra",
					],
					retrievalMode: "sparse" as const,
				},
				{
					queries: [
						"late fee",
						"deposit",
					],
					retrievalMode: "dense" as const,
				},
			];
			const alone = await Promise.all(
				searches.map((filters, index) => repositories[index].search(filters)),
			);
			const before = embedded.length;

			const { results } = await repositories[2].searchMany(
				searches.map((filters, index) => ({
					...filters,
					repositoryId: repositories[index].blockId,
				})),
			);

			expect(embedded.slice(before)).toEqual([
				`${QUERY_PREFIX}refund`,
				`${QUERY_PREFIX}late fee`,
				`${QUERY_PREFIX}deposit`,
			]);
			expect(results).toEqual(alone);
		},
		TIMEOUT,
	);

	test(
		"embeds nothing for sparse searches",
		async () => {
			const { searchMany } = await repositoryOf([
				passages(2, STRONG),
			]);
			const before = embedded.length;

			await searchMany([
				{
					retrievalMode: "sparse",
				},
			]);

			expect(embedded.length).toBe(before);
		},
		TIMEOUT,
	);

	test(
		"fails whole when a repository is not readable",
		async () => {
			const { searchMany } = await repositoryOf([
				passages(2, STRONG),
			]);
			const other = await repositoryOf([
				passages(2, STRONG),
			]);

			expect(
				await searchMany([
					{},
					{
						repositoryId: other.blockId,
					},
				]).then(
					() => undefined,
					(error: { _tag?: string }) => error._tag,
				),
			).toBe("NotFoundError");
		},
		TIMEOUT,
	);

	test(
		"refuses a repository searched twice, or more distinct wordings in all than one search takes, before embedding anything",
		async () => {
			const [first, , third] = await siblings();
			const before = embedded.length;

			expect(
				await codeOf(
					third.searchMany([
						{},
						{
							repositoryId: third.blockId,
						},
					]),
				),
			).toBe("BAD_REQUEST");
			// Each search keeps to its own limit; together they hold one wording too many.
			expect(
				await codeOf(
					third.searchMany([
						{
							queries: [
								"one",
								"two",
								"three",
							],
						},
						{
							repositoryId: first.blockId,
							queries: [
								"three",
								"four",
								"five",
								"six",
							],
						},
					]),
				),
			).toBe("BAD_REQUEST");
			expect(embedded.length).toBe(before);
		},
		TIMEOUT,
	);
});

describe("search limits", () => {
	test(
		"refuse more wordings, or longer ones, than a search takes, before embedding anything",
		async () => {
			const { search } = await repositoryOf([
				passages(1, STRONG),
			]);
			const codeOf = (operation: Promise<unknown>) =>
				operation.then(
					() => undefined,
					(error: { code?: string }) => error.code,
				);
			const before = embedded.length;

			expect(
				await codeOf(
					search({
						queries: Array.from(
							{
								length: SEARCH_QUERIES_MAX + 1,
							},
							(_, index) => `wording ${index}`,
						),
					}),
				),
			).toBe("BAD_REQUEST");
			expect(
				await codeOf(
					search({
						queries: [
							"x".repeat(SEARCH_QUERY_MAX_LENGTH + 1),
						],
					}),
				),
			).toBe("BAD_REQUEST");
			expect(embedded.length).toBe(before);
		},
		TIMEOUT,
	);
});

describe("asset titles", () => {
	test(
		"points carry their asset's title as it is when read",
		async () => {
			const {
				search,
				assets: [assetId],
			} = await repositoryOf([
				[
					STRONG,
				],
			]);
			const titles = async () =>
				(
					await search({
						limit: 1,
					})
				).data.map((point) => point.title);

			expect(await titles()).toEqual([
				"Integration asset",
			]);

			await run(
				Effect.gen(function* () {
					yield* (yield* DB)
						.update(dbSchema.asset)
						.set({
							title: "Final title",
						})
						.where(eq(dbSchema.asset.id, assetId));
				}),
			);

			expect(await titles()).toEqual([
				"Final title",
			]);
		},
		TIMEOUT,
	);
});

describe("served points", () => {
	/**
	 * A repository whose one asset's indexed passage is weak, as the newer
	 * attempt's indexing leaves it: `completed` once its completion commits.
	 */
	const reindexing = async ({ completed }: { completed: boolean }) => {
		const repository = await repositoryOf([
			[
				WEAK,
			],
		]);
		const [assetId] = repository.assets;
		const newer = (repository.indexed.get(assetId) ?? 0) + 1;
		await run(
			Effect.gen(function* () {
				yield* (yield* DB)
					.update(dbSchema.blockAsset)
					.set(
						completed
							? {
									indexAttempt: newer,
									indexedAttempt: newer,
								}
							: {
									indexStatus: "active",
									indexAttempt: newer,
								},
					)
					.where(eq(dbSchema.blockAsset.blockId, repository.blockId));
			}),
		);
		/** Strong passages of the newer attempt. */
		const writeNewer = (published: boolean) =>
			storePassages(
				repository.blockId,
				[
					assetId,
				],
				[
					passages(3, STRONG),
				],
				() => newer,
				published,
			);
		return {
			...repository,
			writeNewer,
		};
	};

	for (const completed of [
		false,
		true,
	]) {
		test(
			`unpublished passages of a newer attempt leave the indexed ones served (${completed ? "completed, before its flip" : "running"})`,
			async () => {
				const { search, writeNewer } = await reindexing({
					completed,
				});
				await writeNewer(false);

				const { data } = await search({
					limit: 1,
				});

				expect(similarities(data)).toEqual([
					WEAK,
				]);
			},
			TIMEOUT,
		);
	}

	test(
		"while both attempts are published, the newer one's passages fill a small limit",
		async () => {
			const { search, writeNewer } = await reindexing({
				completed: true,
			});
			await writeNewer(true);

			const { data } = await search({
				limit: 1,
			});

			expect(similarities(data)).toEqual([
				STRONG,
			]);
		},
		TIMEOUT,
	);
});

describe("before embeddings are set up", () => {
	test(
		"dense, sparse and queryless search and browsing fail as not configured",
		async () => {
			const { search, browse } = await repositoryOf([
				passages(2, STRONG),
			]);
			for (const retrievalMode of [
				"dense",
				"sparse",
				"hybrid",
			] as const) {
				expect(
					await reasonOf(
						search(
							{
								retrievalMode,
							},
							unconfiguredIndex,
						),
					),
				).toBe("EMBEDDINGS_NOT_CONFIGURED");
			}
			expect(
				await reasonOf(
					search(
						{
							queries: undefined,
						},
						unconfiguredIndex,
					),
				),
			).toBe("EMBEDDINGS_NOT_CONFIGURED");
			expect(await reasonOf(browse(unconfiguredIndex))).toBe(
				"EMBEDDINGS_NOT_CONFIGURED",
			);
			expect((await search({})).data.length).toBeGreaterThan(0);
		},
		TIMEOUT,
	);
});
