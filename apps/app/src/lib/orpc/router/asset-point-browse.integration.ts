import { describe, expect, test } from "bun:test";
import type { AssetId, BlockId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { QdrantService, upsertPointsToQdrant } from "@orcai/qdrant";
import type { AssetPointBrowseCursor } from "@orcai/schema";
import { and, eq, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import {
	type Actor,
	authzIntegration,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const { run, organizationWith, procedureOptions, createAsset } =
	authzIntegration();

const rejection = (operation: Promise<unknown>) =>
	operation.then(
		() => undefined,
		(error: unknown) => error,
	);

const repository = (assets: AssetId[]) => ({
	type: "database" as const,
	name: "Integration repository",
	description: null,
	contentJson: null,
	status: "ready" as const,
	assets,
	config: {
		minReferences: 1,
		maxReferences: 5,
		defaultReferences: 3,
	},
});

type Passage = {
	page?: number;
	source?: "text" | "image";
};

/**
 * Index `passages` for the asset in the repository, numbered in order, as the
 * link's completed attempt; or, `newer`, as a newer attempt with that publication.
 */
const index = (
	blockId: BlockId,
	assetId: AssetId,
	passages: Passage[],
	{
		newer,
	}: {
		newer?: {
			published: boolean;
		};
	} = {},
) =>
	run(
		Effect.gen(function* () {
			const { collections } = yield* QdrantService;
			const link = and(
				eq(dbSchema.blockAsset.blockId, blockId),
				eq(dbSchema.blockAsset.assetId, assetId),
			);
			const [completed] = newer
				? []
				: yield* (yield* DB)
						.update(dbSchema.blockAsset)
						.set({
							indexStatus: "completed",
							indexedAttempt: sql`${dbSchema.blockAsset.indexAttempt}`,
						})
						.where(link)
						.returning({
							attempt: dbSchema.blockAsset.indexAttempt,
						});
			const [running] = newer
				? yield* (yield* DB)
						.update(dbSchema.blockAsset)
						.set({
							indexStatus: "active",
							indexAttempt: sql`nextval('block_asset_index_attempt_seq')`,
						})
						.where(link)
						.returning({
							attempt: dbSchema.blockAsset.indexAttempt,
						})
				: [];
			const vector = Array.from(
				{
					length: collections.asset.dimensions,
				},
				(_, position) => (position === 0 ? 1 : 0),
			);
			yield* upsertPointsToQdrant({
				points: passages.map((passage, passageIndex) => ({
					id: crypto.randomUUID(),
					vector,
					payload: {
						source: passage.source ?? "text",
						asset_id: assetId,
						block_id: blockId,
						text: `${assetId} ${newer ? "newer" : "passage"} ${passageIndex}`,
						title: "Integration",
						chunkPageStart: passage.page,
						chunkPageEnd: passage.page,
						depth: 0,
						tokens: 2,
						chunk_index: passageIndex,
						chunkCount: passages.length,
						createdAt: new Date().toISOString(),
						index_attempt: (completed ?? running)?.attempt,
						published: newer?.published,
					},
				})),
			});
		}),
	);

/** A ready repository of `count` fresh assets, owned by a member; with an outsider of the organisation. */
const repositoryWith = async (count: number) => {
	const {
		organizationId,
		actors: [owner, outsider],
		zedToken: organizationToken,
	} = await organizationWith([
		"member",
		"member",
	]);
	let zedToken = organizationToken;
	const assets: AssetId[] = [];
	for (let position = 0; position < count; position++) {
		const created = await createAsset(owner, organizationId);
		assets.push(created.asset.id);
		zedToken = created.zedToken ?? zedToken;
	}
	const procedures = await run(Procedures);
	const { data, meta } = await run(
		procedures.block.create(
			repository(assets),
			await procedureOptions(owner, zedToken),
		),
	);
	return {
		owner,
		outsider,
		organizationId,
		assets,
		blockId: data.id,
		zedToken: meta?.zedToken ?? zedToken,
	};
};

const browse = async (
	actor: Actor,
	zedToken: string | undefined,
	input: {
		repositoryId: BlockId;
		assetId?: AssetId;
		cursor?: AssetPointBrowseCursor;
	},
) => {
	const procedures = await run(Procedures);
	return run(
		procedures.assetPoint.browseRepository(
			input,
			await procedureOptions(actor, zedToken),
		),
	);
};

/** The text of every page in turn, following each cursor. */
const browseAll = async (
	actor: Actor,
	zedToken: string | undefined,
	input: {
		repositoryId: BlockId;
		assetId?: AssetId;
	},
) => {
	const pages: string[][] = [];
	let cursor: AssetPointBrowseCursor | undefined;
	do {
		const page = await browse(actor, zedToken, {
			...input,
			cursor,
		});
		pages.push(page.data.map((point) => point.payload.text));
		cursor = page.nextCursor ?? undefined;
	} while (cursor);
	return pages;
};

const passages = (count: number, page?: (position: number) => number) =>
	Array.from(
		{
			length: count,
		},
		(_, position) => ({
			page: page?.(position),
		}),
	);

describe("browsing a repository's passages", () => {
	test(
		"pages through every passage of the repository once",
		async () => {
			const { owner, assets, blockId, zedToken } = await repositoryWith(2);
			await index(blockId, assets[0], passages(70));
			await index(blockId, assets[1], passages(50));

			const pages = await browseAll(owner, zedToken, {
				repositoryId: blockId,
			});

			expect(pages.map((page) => page.length)).toEqual([
				50,
				50,
				20,
			]);
			expect(new Set(pages.flat()).size).toBe(120);
		},
		TIMEOUT,
	);

	test(
		"reads only served passages, though unpublished ones come first",
		async () => {
			const { owner, assets, blockId, zedToken } = await repositoryWith(1);
			const [asset] = assets;
			await index(
				blockId,
				asset,
				passages(3, () => 2),
			);
			await index(
				blockId,
				asset,
				passages(60, () => 1),
				{
					newer: {
						published: false,
					},
				},
			);

			for (const assetId of [
				asset,
				undefined,
			]) {
				expect(
					(
						await browseAll(owner, zedToken, {
							repositoryId: blockId,
							assetId,
						})
					).map((page) =>
						[
							...page,
						].sort(),
					),
				).toEqual([
					[
						`${asset} passage 0`,
						`${asset} passage 1`,
						`${asset} passage 2`,
					],
				]);
			}
		},
		TIMEOUT,
	);

	test(
		"reads both attempts' passages while both are published",
		async () => {
			const { owner, assets, blockId, zedToken } = await repositoryWith(1);
			const [asset] = assets;
			await index(
				blockId,
				asset,
				passages(2, () => 2),
			);
			await index(
				blockId,
				asset,
				passages(2, () => 1),
				{
					newer: {
						published: true,
					},
				},
			);

			expect(
				await browseAll(owner, zedToken, {
					repositoryId: blockId,
					assetId: asset,
				}),
			).toEqual([
				[
					`${asset} newer 0`,
					`${asset} newer 1`,
					`${asset} passage 0`,
					`${asset} passage 1`,
				],
			]);
		},
		TIMEOUT,
	);

	test(
		"reads one asset by page, images on their page, and ends on an exact multiple",
		async () => {
			const { owner, assets, blockId, zedToken } = await repositoryWith(2);
			const [asset, other] = assets;
			// 98 text passages over 49 pages, then two images on pages 1 and 2.
			await index(blockId, asset, [
				...passages(98, (position) => 1 + Math.floor(position / 2)),
				{
					page: 1,
					source: "image",
				},
				{
					page: 2,
					source: "image",
				},
			]);
			await index(blockId, other, passages(3));

			const pages = await browseAll(owner, zedToken, {
				repositoryId: blockId,
				assetId: asset,
			});

			expect(pages.map((page) => page.length)).toEqual([
				50,
				50,
			]);
			expect(pages[0].slice(0, 6)).toEqual([
				`${asset} passage 0`,
				`${asset} passage 1`,
				`${asset} passage 98`,
				`${asset} passage 2`,
				`${asset} passage 3`,
				`${asset} passage 99`,
			]);
			expect(pages[1].at(-1)).toBe(`${asset} passage 97`);
		},
		TIMEOUT,
	);

	test(
		"is refused to a member without access to the repository",
		async () => {
			const { outsider, blockId, zedToken } = await repositoryWith(1);

			expect(
				await rejection(
					browse(outsider, zedToken, {
						repositoryId: blockId,
					}),
				),
			).toMatchObject({
				reason: "PERMISSION_DENIED",
			});
		},
		TIMEOUT,
	);

	test(
		"shows nothing of an asset outside the repository, or detached from it",
		async () => {
			const { owner, organizationId, assets, blockId, zedToken } =
				await repositoryWith(2);
			const [kept, detached] = assets;
			await index(blockId, kept, passages(2));
			await index(blockId, detached, passages(2));
			const elsewhere = await createAsset(owner, organizationId);
			await index(blockId, elsewhere.asset.id, passages(2));

			const procedures = await run(Procedures);
			const updated = await run(
				procedures.block.update(
					{
						id: blockId,
						...repository([
							kept,
						]),
					},
					await procedureOptions(owner, elsewhere.zedToken ?? zedToken),
				),
			);
			const token = updated.meta?.zedToken ?? zedToken;

			for (const assetId of [
				detached,
				elsewhere.asset.id,
			]) {
				expect(
					await browse(owner, token, {
						repositoryId: blockId,
						assetId,
					}),
				).toEqual({
					data: [],
					nextCursor: null,
				});
			}
			const all = await browseAll(owner, token, {
				repositoryId: blockId,
			});
			expect(all.flat().sort()).toEqual([
				`${kept} passage 0`,
				`${kept} passage 1`,
			]);
		},
		TIMEOUT,
	);

	test(
		"stops at an asset detached between two pages",
		async () => {
			const { owner, assets, blockId, zedToken } = await repositoryWith(2);
			const [asset, kept] = assets;
			await index(blockId, asset, passages(60));
			await index(blockId, kept, passages(60));

			const first = await browse(owner, zedToken, {
				repositoryId: blockId,
				assetId: asset,
			});
			expect(first.data).toHaveLength(50);
			const procedures = await run(Procedures);
			const updated = await run(
				procedures.block.update(
					{
						id: blockId,
						...repository([
							kept,
						]),
					},
					await procedureOptions(owner, zedToken),
				),
			);

			expect(
				await browse(owner, updated.meta?.zedToken ?? zedToken, {
					repositoryId: blockId,
					assetId: asset,
					cursor: first.nextCursor ?? undefined,
				}),
			).toEqual({
				data: [],
				nextCursor: null,
			});
		},
		TIMEOUT,
	);

	test(
		"of an empty repository is empty",
		async () => {
			const { owner, blockId, zedToken } = await repositoryWith(0);

			expect(
				await browse(owner, zedToken, {
					repositoryId: blockId,
				}),
			).toEqual({
				data: [],
				nextCursor: null,
			});
		},
		TIMEOUT,
	);

	test(
		"refuses a cursor of the other order",
		async () => {
			const { owner, assets, blockId, zedToken } = await repositoryWith(1);

			expect(
				await rejection(
					browse(owner, zedToken, {
						repositoryId: blockId,
						cursor: {
							order: "reading",
							page: 1,
							passageIndex: 0,
						},
					}),
				),
			).toBeDefined();
			expect(
				await rejection(
					browse(owner, zedToken, {
						repositoryId: blockId,
						assetId: assets[0],
						cursor: {
							order: "point",
							from: crypto.randomUUID(),
						},
					}),
				),
			).toBeDefined();
		},
		TIMEOUT,
	);
});
