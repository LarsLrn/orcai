import { afterAll, describe, expect, test } from "bun:test";
import { AiConfigService } from "@orcai/ai";
import { type AssetId, type BlockId, buckets } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	deletePointsByIdentifier,
	QdrantLive,
	QdrantService,
	upsertPointsToQdrant,
} from "@orcai/qdrant";
import type { AssetPoint, assetPointsFiltersSchema } from "@orcai/schema";
import { serve } from "bun";
import { eq, sql } from "drizzle-orm";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import type { z } from "zod/v4";
import {
	type Actor,
	authzIntegration,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import { writeRelationships } from "@/lib/authz/relationship-write";
import { initializeResourceAuthorization } from "@/lib/authz/resource-lifecycle";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const { run, organizationWith, procedureOptions } = authzIntegration();

const dimensions = await run(
	QdrantService.pipe(
		Effect.map(({ collections }) => collections.asset.dimensions),
	),
);

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

/** An OpenAI-compatible endpoint that embeds every query as the same vector. */
const embeddings = serve({
	port: 0,
	fetch: () =>
		Response.json({
			object: "list",
			data: [
				{
					object: "embedding",
					index: 0,
					embedding: at(1),
				},
			],
			model: "integration",
			usage: {
				prompt_tokens: 1,
				total_tokens: 1,
			},
		}),
});

const stored: AssetId[] = [];
// The shared runtime is disposed by the time this runs.
afterAll(async () => {
	await embeddings.stop(true);
	await Effect.runPromise(
		Effect.forEach(stored, (assetId) =>
			deletePointsByIdentifier({
				assetId,
				blockId: undefined,
			}),
		).pipe(Effect.provide(QdrantLive)),
	);
});

/** The actor's call options with queries embedded by the endpoint above. */
const embeddingThroughEndpoint = async (actor: Actor, zedToken?: string) => {
	const options = await procedureOptions(actor, zedToken);
	return {
		context: {
			...options.context,
			"effect/context": Context.add(
				options.context["effect/context"],
				AiConfigService,
				{
					config: {
						baseUrl: `${embeddings.url.origin}/v1`,
						apiKey: Redacted.make("key"),
						embedding: {
							model: "integration",
						},
					},
				},
			),
		},
	};
};

const STRONG = 0.8;
// Below the 0.5 threshold, above the relaxed pass's 0.28.
const WEAK = 0.4;
const UNRELATED = 0.1;

/** A ready repository of assets whose passages lie at these similarities to the query. */
const repositoryOf = async (passageSimilarities: number[][]) => {
	const {
		organizationId,
		actors: [owner],
		zedToken,
	} = await organizationWith([
		"member",
	]);
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
		(assetId) => indexed.get(assetId),
	);

	const search = async (filters: z.infer<typeof assetPointsFiltersSchema>) =>
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
				await embeddingThroughEndpoint(owner, block.meta?.zedToken),
			),
		);

	return {
		assets: assets.result,
		blockId: block.data.id,
		indexed,
		search,
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
	attempt: (assetId: AssetId) => number | undefined,
	published?: boolean,
) =>
	run(
		Effect.gen(function* () {
			stored.push(...assets);
			yield* upsertPointsToQdrant({
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
			});
		}),
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
