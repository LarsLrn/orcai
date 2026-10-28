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
						general: {
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

/** A ready repository of documents whose chunks lie at these similarities to the query. */
const repositoryOf = async (documents: number[][]) => {
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
			Effect.forEach(documents, () =>
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
				type: "database",
				name: "Integration repository",
				description: null,
				contentJson: null,
				contentHtml: null,
				status: "ready",
				assets: assets.result,
				config: {
					minReferences: 1,
					maxReferences: 5,
					defaultReferences: 3,
				},
			},
			await procedureOptions(owner, assets.zedToken ?? zedToken),
		),
	);
	await storeChunks(block.data.id, assets.result, documents);

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
		search,
	};
};

const storeChunks = (
	blockId: BlockId,
	assets: AssetId[],
	documents: number[][],
) =>
	run(
		Effect.gen(function* () {
			stored.push(...assets);
			yield* upsertPointsToQdrant({
				points: assets.flatMap((assetId, document) =>
					documents[document].map((similarity, index, all) => ({
						id: crypto.randomUUID(),
						vector: at(similarity),
						payload: {
							source: "text" as const,
							asset_id: assetId,
							block_id: blockId,
							text: `Chunk ${index} at ${similarity}`,
							title: "Integration asset",
							depth: 0,
							tokens: 4,
							chunk_index: index,
							chunkCount: all.length,
							createdAt: new Date().toISOString(),
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

const chunks = (count: number, similarity: number) =>
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
		"fills the limit from a single document",
		async () => {
			const { search } = await repositoryOf([
				[
					...chunks(12, STRONG),
					...chunks(2, UNRELATED),
				],
			]);

			const { data } = await search({
				limit: 10,
			});

			expect(similarities(data)).toEqual(chunks(10, STRONG));
		},
		TIMEOUT,
	);

	test(
		"backfills only with chunks a recall pass admits, and leaves the rest of the slots empty",
		async () => {
			const { search } = await repositoryOf([
				[
					...chunks(4, STRONG),
					WEAK,
					...chunks(2, UNRELATED),
				],
			]);

			const { data, metadata } = await search({
				limit: 10,
			});

			expect(similarities(data)).toEqual([
				...chunks(4, STRONG),
				WEAK,
			]);
			expect(metadata?.scoreThreshold).toBeCloseTo(0.28);
		},
		TIMEOUT,
	);

	test(
		"caps chunks per document when enough documents match",
		async () => {
			const { search, assets } = await repositoryOf([
				chunks(4, STRONG),
				chunks(4, STRONG),
				chunks(4, STRONG),
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
		"fills what the cap leaves from the document with more matches",
		async () => {
			const { search, assets } = await repositoryOf([
				chunks(8, STRONG),
				chunks(1, STRONG),
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
		"a recall budget above the limit finds the documents a strong one would crowd out",
		async () => {
			const {
				search,
				assets: [strong, first, second],
			} = await repositoryOf([
				chunks(12, STRONG),
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
