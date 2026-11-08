import { describe, expect, test } from "bun:test";
import type { AssetId, BlockId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { and, eq, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { attachAssets } from "@/lib/ai/turn/attachments";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import { appIntegration, TIMEOUT } from "@/lib/testing/app-integration";

const { run, organizationWith, caller, createAsset } = appIntegration();

const tagOf = (operation: Promise<unknown>) =>
	operation.then(
		() => undefined,
		(error: { _tag?: string }) => error._tag,
	);

/**
 * An author's bot with a repository holding one asset, shared with a
 * member who reaches the repository and the asset only through the bot.
 */
const sharedRepository = async () => {
	const {
		organizationId,
		actors: [author, member],
		zedToken,
	} = await organizationWith([
		"admin",
		"member",
	]);
	const procedures = await run(Procedures);
	const { call, observe, token } = caller(zedToken);

	const {
		asset: { id: assetId },
		zedToken: assetToken,
	} = await createAsset(author, organizationId);
	observe(assetToken);
	const { data: repository } = await call(author, (options) =>
		procedures.block.create(
			{
				type: "repository",
				name: "Shared repository",
				description: null,
				contentJson: null,
				status: "ready",
				assets: [
					assetId,
				],
				config: {
					minPassages: 1,
					maxPassages: 5,
					defaultPassages: 3,
				},
			},
			options,
		),
	);
	const { data: bot } = await call(author, (options) =>
		procedures.bot.save(
			{
				name: `Content bot ${crypto.randomUUID()}`,
				description: "Integration bot",
				status: "draft",
				repositoryIds: [
					repository.id,
				],
			},
			options,
		),
	);
	await call(author, (options) =>
		procedures.resource.grant(
			{
				resourceType: "bot",
				resourceId: bot.id,
				role: "viewer",
				principals: [
					{
						principalType: "user",
						principalId: member.user.id,
					},
				],
			},
			options,
		),
	);

	// Owning unrelated resources must not open the shared ones.
	await createAsset(member, organizationId);
	const { data: ownBlock } = await call(member, (options) =>
		procedures.block.create(
			{
				type: "behaviour",
				name: "Own behaviour",
				description: null,
				contentJson: null,
				status: "ready",
				config: {
					systemPrompt: "",
				},
			},
			options,
		),
	);
	await call(member, (options) =>
		procedures.bot.save(
			{
				name: `Own bot ${crypto.randomUUID()}`,
				description: "Integration bot",
				status: "draft",
				behaviourId: ownBlock.id,
			},
			options,
		),
	);

	const reads = async () => ({
		block: await tagOf(
			call(member, (options) =>
				procedures.block.find(
					{
						id: repository.id,
					},
					options,
				),
			),
		),
		asset: await tagOf(
			call(member, (options) =>
				procedures.asset.find(
					{
						id: assetId,
					},
					options,
				),
			),
		),
		listed: {
			block: (
				await call(member, (options) =>
					procedures.block.list(
						{
							pageIndex: 0,
							pageSize: 100,
						},
						options,
					),
				)
			).data.some((block) => block.id === repository.id),
			asset: (
				await call(member, (options) =>
					procedures.asset.list(
						{
							pageIndex: 0,
							pageSize: 100,
						},
						options,
					),
				)
			).data.some((asset) => asset.id === assetId),
		},
		readiness: (
			await call(member, (options) =>
				procedures.block.readiness(
					{
						blockIds: [
							repository.id,
						],
					},
					options,
				),
			)
		).data.length,
		botBlocks: (
			await call(member, (options) =>
				procedures.block.list(
					{
						pageIndex: 0,
						pageSize: 10,
						filters: {
							botId: bot.id,
						},
					},
					options,
				),
			)
		).data.map((block) => block.id),
	});

	/** Every read of one resource the member reaches through the bot. */
	const finds = async () => {
		const read = <A>(
			operation: Parameters<typeof call<A>>[1],
		): Promise<string | undefined> => tagOf(call(member, operation));
		const [
			botFind,
			favourite,
			setup,
			visibility,
			blockFind,
			search,
			searchMany,
			browse,
			assetFind,
			download,
		] = await Promise.all([
			read((options) =>
				procedures.bot.find(
					{
						id: bot.id,
					},
					options,
				),
			),
			read((options) =>
				procedures.bot.setFavourite(
					{
						id: bot.id,
						favourite: true,
					},
					options,
				),
			),
			read((options) =>
				procedures.botSetup.find(
					{
						botId: bot.id,
					},
					options,
				),
			),
			read((options) =>
				procedures.resource.getVisibility(
					{
						resourceType: "bot",
						resourceId: bot.id,
					},
					options,
				),
			),
			read((options) =>
				procedures.block.find(
					{
						id: repository.id,
					},
					options,
				),
			),
			// Ids outside the repository keep both off the vector store.
			read((options) =>
				procedures.assetPoint.searchRepository(
					{
						repositoryId: repository.id,
						filters: {
							assetIds: [
								crypto.randomUUID(),
							],
						},
					},
					options,
				),
			),
			read((options) =>
				procedures.assetPoint.searchRepositories(
					{
						searches: [
							{
								repositoryId: repository.id,
								filters: {
									assetIds: [
										crypto.randomUUID(),
									],
								},
							},
						],
					},
					options,
				),
			),
			read((options) =>
				procedures.assetPoint.browseRepository(
					{
						repositoryId: repository.id,
						assetId: crypto.randomUUID() as AssetId,
					},
					options,
				),
			),
			read((options) =>
				procedures.asset.find(
					{
						id: assetId,
					},
					options,
				),
			),
			read((options) =>
				procedures.storage.createDownloadUrl(
					{
						id: assetId,
					},
					options,
				),
			),
		]);
		return {
			bot: {
				find: botFind,
				setFavourite: favourite,
				setup,
				visibility,
			},
			block: {
				find: blockFind,
				search,
				searchMany,
				browse,
			},
			asset: {
				find: assetFind,
				download,
			},
		};
	};

	/** Removes the bot's link in Postgres only, as a write whose tuples are not delivered yet leaves it. */
	const unlinkWithoutTuples = () =>
		run(
			Effect.gen(function* () {
				yield* (yield* DB)
					.delete(dbSchema.botBlock)
					.where(eq(dbSchema.botBlock.botId, bot.id));
			}),
		);

	/** Changes a committed row only, as a write whose tuples are not delivered yet leaves it. */
	const withoutTuples = (change: Effect.Effect<unknown, unknown, DB>) =>
		run(change);

	/** Changes the member's grant on a resource in Postgres only. */
	const changeGrantWithoutTuples = (
		resourceId: string,
		change: Partial<typeof dbSchema.resourceGrant.$inferInsert>,
	) =>
		withoutTuples(
			Effect.gen(function* () {
				yield* (yield* DB)
					.update(dbSchema.resourceGrant)
					.set(change)
					.where(
						and(
							eq(dbSchema.resourceGrant.resourceId, resourceId),
							eq(dbSchema.resourceGrant.principalId, member.user.id),
						),
					);
			}),
		);

	const revokeWithoutTuples = (resourceId: string) =>
		changeGrantWithoutTuples(resourceId, {
			revokedAt: new Date(),
		});

	/** Why the member cannot carry the asset into a message or their own repository. */
	const admissions = async () => ({
		message: await tagOf(
			run(
				attachAssets(
					[
						{
							assetId,
						},
					],
					{
						userId: member.user.id,
						zedToken: token(),
					},
				),
			),
		),
		repository: await tagOf(
			call(member, (options) =>
				procedures.block.create(
					{
						type: "repository",
						name: "Copied repository",
						description: null,
						contentJson: null,
						status: "ready",
						assets: [
							assetId,
						],
						config: {
							minPassages: 1,
							maxPassages: 5,
							defaultPassages: 3,
						},
					},
					options,
				),
			),
		),
	});

	return {
		admissions,
		author,
		finds,
		member,
		procedures,
		call,
		bot,
		repositoryId: repository.id as BlockId,
		reads,
		changeGrantWithoutTuples,
		revokeWithoutTuples,
		unlinkWithoutTuples,
		withoutTuples,
	};
};

/** What the member reads once no committed path reaches the repository. */
const closed = {
	block: "NotFoundError",
	asset: "NotFoundError",
	listed: {
		block: false,
		asset: false,
	},
	readiness: 0,
	botBlocks: [],
};

/** The member's single-resource reads while the bot grant holds; the bot is a draft, so it cannot be a favourite. */
const found = {
	bot: {
		find: undefined,
		setFavourite: "BadRequestError",
		setup: undefined,
		visibility: undefined,
	},
	block: {
		find: undefined,
		search: undefined,
		searchMany: undefined,
		browse: undefined,
	},
	asset: {
		find: undefined,
		download: undefined,
	},
};

const missing = {
	bot: {
		find: "NotFoundError",
		setFavourite: "NotFoundError",
		setup: "NotFoundError",
		visibility: "NotFoundError",
	},
	block: {
		find: "NotFoundError",
		search: "NotFoundError",
		searchMany: "NotFoundError",
		browse: "NotFoundError",
	},
	asset: {
		find: "NotFoundError",
		download: "NotFoundError",
	},
};

const refused = {
	message: "ForbiddenError",
	repository: "ForbiddenError",
};

describe("reading contents while tuples lag", () => {
	test(
		"revoking the member's bot grant closes the bot's contents before its tuple goes",
		async () => {
			const { admissions, finds, bot, reads, revokeWithoutTuples } =
				await sharedRepository();
			expect(await finds()).toEqual(found);
			await revokeWithoutTuples(bot.id);
			expect(await reads()).toEqual(closed);
			expect(await finds()).toEqual(missing);
			expect(await admissions()).toEqual(refused);
		},
		TIMEOUT,
	);

	test(
		"unlisting a bot and its repository closes them to readers they reached only by listing",
		async () => {
			const {
				admissions,
				author,
				member,
				procedures,
				call,
				bot,
				repositoryId,
				reads,
				withoutTuples,
			} = await sharedRepository();
			await call(author, (options) =>
				procedures.resource.setVisibility(
					{
						resourceType: "bot",
						resourceId: bot.id,
						visibility: "public",
						listBlockIds: [
							repositoryId,
						],
					},
					options,
				),
			);
			await call(author, (options) =>
				procedures.resource.revoke(
					{
						resourceType: "bot",
						resourceId: bot.id,
						principalType: "user",
						principalId: member.user.id,
					},
					options,
				),
			);
			expect(await reads()).toMatchObject({
				block: undefined,
				asset: undefined,
			});

			await withoutTuples(
				Effect.gen(function* () {
					yield* (yield* DB)
						.update(dbSchema.resourceVisibility)
						.set({
							visibility: "private",
						})
						.where(
							inArray(dbSchema.resourceVisibility.resourceId, [
								bot.id,
								repositoryId,
							]),
						);
				}),
			);
			expect(await reads()).toEqual(closed);
			expect(await admissions()).toEqual(refused);
		},
		TIMEOUT,
	);

	test(
		"a removed bot link closes the repository and its assets before its tuple goes",
		async () => {
			const { admissions, repositoryId, reads, unlinkWithoutTuples } =
				await sharedRepository();
			expect(await reads()).toEqual({
				block: undefined,
				asset: undefined,
				listed: {
					block: true,
					asset: true,
				},
				readiness: 1,
				botBlocks: [
					repositoryId,
				],
			});

			await unlinkWithoutTuples();
			expect(await reads()).toEqual(closed);
			expect(await admissions()).toEqual(refused);
		},
		TIMEOUT,
	);

	test(
		"a direct grant and a listing keep their reads when the bot link goes",
		async () => {
			const {
				author,
				member,
				procedures,
				call,
				repositoryId,
				reads,
				unlinkWithoutTuples,
			} = await sharedRepository();
			await call(author, (options) =>
				procedures.resource.grant(
					{
						resourceType: "block",
						resourceId: repositoryId,
						role: "viewer",
						principals: [
							{
								principalType: "user",
								principalId: member.user.id,
							},
						],
					},
					options,
				),
			);
			await unlinkWithoutTuples();
			expect(await reads()).toEqual({
				block: undefined,
				asset: undefined,
				listed: {
					block: true,
					asset: true,
				},
				readiness: 1,
				botBlocks: [],
			});

			await call(author, (options) =>
				procedures.resource.revoke(
					{
						resourceType: "block",
						resourceId: repositoryId,
						principalType: "user",
						principalId: member.user.id,
					},
					options,
				),
			);
			await call(author, (options) =>
				procedures.resource.setVisibility(
					{
						resourceType: "block",
						resourceId: repositoryId,
						visibility: "public",
					},
					options,
				),
			);
			expect(await reads()).toMatchObject({
				block: undefined,
				asset: undefined,
			});
		},
		TIMEOUT,
	);
});

describe("inherited access while tuples lag", () => {
	/** The shared repository, which the member also manages directly. */
	const managedRepository = async () => {
		const shared = await sharedRepository();
		const { author, member, procedures, call, repositoryId } = shared;
		await call(author, (options) =>
			procedures.resource.grant(
				{
					resourceType: "block",
					resourceId: repositoryId,
					role: "manager",
					principals: [
						{
							principalType: "user",
							principalId: member.user.id,
						},
					],
				},
				options,
			),
		);
		const inherited = () =>
			call(member, (options) =>
				procedures.resource.inheritedAccess(
					{
						resourceType: "block",
						resourceId: repositoryId,
					},
					options,
				),
			);
		return {
			...shared,
			inherited,
		};
	};

	test(
		"a manager demoted to a viewer is refused before the manager tuple goes",
		async () => {
			const { repositoryId, inherited, changeGrantWithoutTuples } =
				await managedRepository();
			expect(await tagOf(inherited())).toBeUndefined();

			await changeGrantWithoutTuples(repositoryId, {
				role: "viewer",
			});
			expect(await tagOf(inherited())).toBe("ForbiddenError");
		},
		TIMEOUT,
	);

	test(
		"an ancestor whose grant was revoked is hidden before its tuple goes",
		async () => {
			const { bot, inherited, revokeWithoutTuples } = await managedRepository();
			expect((await inherited()).data).toMatchObject({
				ancestors: [
					{
						resourceType: "bot",
						resourceId: bot.id,
					},
				],
				hiddenAncestorCount: 0,
			});

			await revokeWithoutTuples(bot.id);
			expect((await inherited()).data).toMatchObject({
				ancestors: [],
				botCount: 1,
				hiddenAncestorCount: 1,
			});
		},
		TIMEOUT,
	);
});
