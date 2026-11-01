import { describe, expect, test } from "bun:test";
import type { BlockId, BotId, OrganizationId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { ResourceVisibility } from "@orcai/schema";
import { and, eq, isNull } from "drizzle-orm";
import * as Effect from "effect/Effect";
import {
	type Actor,
	authzIntegration,
	queueBehindOrganizationLock,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import type { ResourceRef } from "@/lib/authz/relationship-facts";
import { grantResourceAccess } from "@/lib/authz/resource-access";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const {
	run,
	organizationWith,
	procedureOptions,
	createAsset,
	readTuples,
	instanceAdmin,
} = authzIntegration();

const outcomeOf = (operation: Promise<unknown>) =>
	operation.then(
		() => ({
			reason: undefined,
			params: undefined,
		}),
		(error: { reason?: string; params?: unknown }) => ({
			reason: error.reason ?? "failed",
			params: error.params,
		}),
	);

const reasonOf = async (operation: Promise<unknown>) =>
	(await outcomeOf(operation)).reason;

/**
 * An author's draft bot with a behaviour and a repository in its home
 * organisation, a member there, and a second organisation with an admin and
 * a viewer that installs resources through direct scope rows.
 */
const twoOrganizations = async () => {
	const {
		organizationId: home,
		actors: [author, member],
		zedToken,
	} = await organizationWith([
		"admin",
		"member",
	]);
	const {
		organizationId: other,
		actors: [otherAdmin, viewer],
	} = await organizationWith([
		"admin",
		"member",
	]);
	const procedures = await run(Procedures);
	let token = zedToken;
	const call = async <A>(
		actor: Actor,
		operation: (
			options: Awaited<ReturnType<typeof procedureOptions>>,
		) => Effect.Effect<
			A & {
				meta?: {
					zedToken?: string;
				};
			},
			unknown
		>,
	) => {
		const result = await run(operation(await procedureOptions(actor, token)));
		token = result.meta?.zedToken ?? token;
		return result;
	};

	const createBlock = async (
		actor: Actor,
		type: "template" | "database",
		name = `Listing ${type} ${crypto.randomUUID()}`,
	): Promise<BlockId> =>
		(
			await call(actor, (options) =>
				procedures.block.create(
					type === "template"
						? {
								type,
								name,
								description: null,
								contentJson: null,
								status: "ready",
								config: {
									systemPrompt: "Answer from the handbook.",
								},
							}
						: {
								type,
								name,
								description: null,
								contentJson: null,
								status: "ready",
								assets: [],
								config: {
									minReferences: 1,
									maxReferences: 5,
									defaultReferences: 3,
								},
							},
					options,
				),
			)
		).data.id;

	const saveBot = (
		actor: Actor,
		bot: {
			id?: BotId;
			templateBlockId?: BlockId;
			databaseBlockIds: BlockId[];
			listBlockIds?: BlockId[];
		},
	) =>
		call(actor, (options) =>
			procedures.bot.save(
				{
					name: `Listing bot ${crypto.randomUUID()}`,
					description: "Integration bot",
					status: "draft",
					...bot,
				},
				options,
			),
		).then(({ data }) => data.id);

	const template = await createBlock(author, "template");
	const repository = await createBlock(author, "database");
	const bot = await saveBot(author, {
		templateBlockId: template,
		databaseBlockIds: [
			repository,
		],
	});

	const setVisibility = (
		actor: Actor,
		resource: ResourceRef,
		visibility: ResourceVisibility,
		listBlockIds: BlockId[] = [],
	) =>
		call(actor, (options) =>
			procedures.resource.setVisibility(
				{
					...resource,
					visibility,
					listBlockIds,
				} as Parameters<typeof procedures.resource.setVisibility>[0],
				options,
			),
		);

	const visibilityOf = async (resource: ResourceRef) =>
		(
			await call(author, (options) =>
				procedures.resource.getVisibility(resource, options),
			)
		).data.visibility;

	/** Scopes the resource to the second organisation, as an install will. */
	const install = (resource: ResourceRef) =>
		run(
			Effect.gen(function* () {
				yield* (yield* DB).insert(dbSchema.resourceScope).values({
					...resource,
					organizationId: other,
					isPrimary: false,
					assignedBy: otherAdmin.user.id,
				});
			}),
		);

	const grantInOther = (resource: ResourceRef, actor: Actor) =>
		run(
			grantResourceAccess({
				resource,
				organizationId: other,
				principals: [
					{
						principalType: "user",
						principalId: actor.user.id,
					},
				],
				role: "viewer",
				actor: {
					userId: otherAdmin.user.id,
					zedToken: token,
				},
			}),
		).then(({ zedToken: written }) => {
			token = written ?? token;
		});

	return {
		home,
		other,
		author,
		member,
		otherAdmin,
		viewer,
		procedures,
		call,
		createBlock,
		saveBot,
		template,
		repository,
		bot,
		setVisibility,
		visibilityOf,
		install,
		grantInOther,
		token: () => token,
		/** Reads later calls at least as fresh as a write made outside the procedures. */
		advance: (written: string | undefined) => {
			token = written ?? token;
		},
	};
};

const botRef = (botId: BotId) =>
	({
		resourceType: "bot",
		resourceId: botId,
	}) as const;

const blockRef = (blockId: BlockId) =>
	({
		resourceType: "block",
		resourceId: blockId,
	}) as const;

/** The organisations the resource is installed in. */
const installedIn = (resource: ResourceRef) =>
	run(
		Effect.gen(function* () {
			const rows = yield* (yield* DB)
				.select({
					organizationId: dbSchema.resourceScope.organizationId,
				})
				.from(dbSchema.resourceScope)
				.where(
					and(
						eq(dbSchema.resourceScope.resourceType, resource.resourceType),
						eq(dbSchema.resourceScope.resourceId, resource.resourceId),
						eq(dbSchema.resourceScope.isPrimary, false),
						isNull(dbSchema.resourceScope.endedAt),
					),
				);
			return rows.map((row) => row.organizationId);
		}),
	);

const activeGrantsIn = (
	resource: ResourceRef,
	organizationId: OrganizationId,
) =>
	run(
		Effect.gen(function* () {
			return yield* (yield* DB)
				.select({
					principalId: dbSchema.resourceGrant.principalId,
				})
				.from(dbSchema.resourceGrant)
				.where(
					and(
						eq(dbSchema.resourceGrant.resourceType, resource.resourceType),
						eq(dbSchema.resourceGrant.resourceId, resource.resourceId),
						eq(dbSchema.resourceGrant.organizationId, organizationId),
						isNull(dbSchema.resourceGrant.revokedAt),
					),
				);
		}),
	);

const linkedBots = (blockId: BlockId) =>
	run(
		Effect.gen(function* () {
			const rows = yield* (yield* DB)
				.select({
					botId: dbSchema.botBlock.botId,
				})
				.from(dbSchema.botBlock)
				.where(eq(dbSchema.botBlock.blockId, blockId));
			return rows.map((row) => row.botId).sort();
		}),
	);

describe("listing a bot", () => {
	test(
		"lists its unlisted blocks only with manage_access on each and once confirmed",
		async () => {
			const s = await twoOrganizations();
			const membersRepository = await s.createBlock(s.member, "database");
			await s.call(s.member, (options) =>
				s.procedures.resource.grant(
					{
						resourceType: "block",
						resourceId: membersRepository,
						role: "editor",
						principals: [
							{
								principalType: "user",
								principalId: s.author.user.id,
							},
						],
					},
					options,
				),
			);
			await s.saveBot(s.author, {
				id: s.bot,
				templateBlockId: s.template,
				databaseBlockIds: [
					s.repository,
					membersRepository,
				],
			});

			const forbidden = await outcomeOf(
				s.setVisibility(s.author, botRef(s.bot), "public", [
					s.template,
					s.repository,
					membersRepository,
				]),
			);
			expect(forbidden.reason).toBe("LISTING_BLOCKS_FORBIDDEN");
			expect(await s.visibilityOf(botRef(s.bot))).toBe("private");

			await s.saveBot(s.author, {
				id: s.bot,
				templateBlockId: s.template,
				databaseBlockIds: [
					s.repository,
				],
			});
			const unconfirmed = await outcomeOf(
				s.setVisibility(s.author, botRef(s.bot), "public", [
					s.template,
				]),
			);
			expect(unconfirmed).toEqual({
				reason: "LISTING_BLOCKS_UNCONFIRMED",
				params: {
					blocks: [
						expect.objectContaining({
							id: s.repository,
						}),
					],
				},
			});

			await s.setVisibility(s.author, botRef(s.bot), "public", [
				s.template,
				s.repository,
			]);
			expect(
				await Promise.all([
					s.visibilityOf(botRef(s.bot)),
					s.visibilityOf(blockRef(s.template)),
					s.visibilityOf(blockRef(s.repository)),
				]),
			).toEqual([
				"public",
				"public",
				"public",
			]);
		},
		TIMEOUT,
	);

	test(
		"a listed bot gains an unlisted block only once it is confirmed",
		async () => {
			const s = await twoOrganizations();
			await s.setVisibility(s.author, botRef(s.bot), "public", [
				s.template,
				s.repository,
			]);
			const added = await s.createBlock(s.author, "database");
			const bot = {
				id: s.bot,
				templateBlockId: s.template,
				databaseBlockIds: [
					s.repository,
					added,
				],
			};

			expect(await reasonOf(s.saveBot(s.author, bot))).toBe(
				"LISTING_BLOCKS_UNCONFIRMED",
			);
			expect(await linkedBots(added)).toEqual([]);

			await s.saveBot(s.author, {
				...bot,
				listBlockIds: [
					added,
				],
			});
			expect(await linkedBots(added)).toEqual([
				s.bot,
			]);
			expect(await s.visibilityOf(blockRef(added))).toBe("public");
		},
		TIMEOUT,
	);
});

describe("listing while tuples lag", () => {
	/** The author manages the member's repository and links it into their bot. */
	const managedRepository = async () => {
		const s = await twoOrganizations();
		const membersRepository = await s.createBlock(s.member, "database");
		await s.call(s.member, (options) =>
			s.procedures.resource.grant(
				{
					resourceType: "block",
					resourceId: membersRepository,
					role: "manager",
					principals: [
						{
							principalType: "user",
							principalId: s.author.user.id,
						},
					],
				},
				options,
			),
		);
		await s.saveBot(s.author, {
			id: s.bot,
			templateBlockId: s.template,
			databaseBlockIds: [
				membersRepository,
			],
		});
		/** Ends the author's grant in Postgres only, as before its tuples are delivered. */
		const revokeWithoutTuples = (resource: ResourceRef) =>
			run(
				Effect.gen(function* () {
					yield* (yield* DB)
						.update(dbSchema.resourceGrant)
						.set({
							revokedAt: new Date(),
						})
						.where(
							and(
								eq(dbSchema.resourceGrant.resourceId, resource.resourceId),
								eq(dbSchema.resourceGrant.principalId, s.author.user.id),
							),
						);
				}),
			);
		return {
			...s,
			membersRepository,
			revokeWithoutTuples,
		};
	};

	test(
		"a block's revoked manager grant no longer lists it with the bot",
		async () => {
			const s = await managedRepository();
			await s.revokeWithoutTuples(blockRef(s.membersRepository));
			expect(
				await readTuples({
					resourceType: "block",
					resourceId: s.membersRepository,
					subjectId: s.author.user.id,
				}),
			).toEqual([
				`manager@user:${s.author.user.id}`,
			]);

			expect(
				await reasonOf(
					s.setVisibility(s.author, botRef(s.bot), "public", [
						s.template,
						s.membersRepository,
					]),
				),
			).toBe("LISTING_BLOCKS_FORBIDDEN");
			expect(await s.visibilityOf(blockRef(s.membersRepository))).toBe(
				"private",
			);
		},
		TIMEOUT,
	);

	test(
		"a revoked manager grant no longer lists the resource itself",
		async () => {
			const s = await managedRepository();
			await s.revokeWithoutTuples(blockRef(s.membersRepository));

			expect(
				await reasonOf(
					s.setVisibility(s.author, blockRef(s.membersRepository), "public"),
				),
			).toBe("PERMISSION_DENIED");
		},
		TIMEOUT,
	);
});

describe("documents", () => {
	test(
		"are listed only through their repository, and a listed one can be unlisted",
		async () => {
			const s = await twoOrganizations();
			const { asset, zedToken } = await createAsset(s.author, s.home);
			s.advance(zedToken);
			const document = {
				resourceType: "asset",
				resourceId: asset.id,
			} as const;

			expect(
				await reasonOf(s.setVisibility(s.author, document, "public")),
			).toBe("ASSET_LISTING_UNSUPPORTED");
			expect(await s.visibilityOf(document)).toBe("private");

			await run(
				Effect.gen(function* () {
					yield* (yield* DB)
						.update(dbSchema.resourceVisibility)
						.set({
							visibility: "public",
						})
						.where(eq(dbSchema.resourceVisibility.resourceId, asset.id));
				}),
			);
			await s.setVisibility(s.author, document, "private");
			expect(await s.visibilityOf(document)).toBe("private");
		},
		TIMEOUT,
	);
});

describe("unlisting", () => {
	test(
		"is refused for a block a listed bot contains",
		async () => {
			const s = await twoOrganizations();
			await s.setVisibility(s.author, botRef(s.bot), "public", [
				s.template,
				s.repository,
			]);

			expect(
				await reasonOf(
					s.setVisibility(s.author, blockRef(s.repository), "private"),
				),
			).toBe("BLOCK_USED_BY_LISTED_BOTS");
			expect(await s.visibilityOf(blockRef(s.repository))).toBe("public");
		},
		TIMEOUT,
	);

	test(
		"ends every install with the installing organisation's grants, setup, links and attachments",
		async () => {
			const s = await twoOrganizations();
			await s.setVisibility(s.author, botRef(s.bot), "public", [
				s.template,
				s.repository,
			]);
			await s.install(botRef(s.bot));
			await s.install(blockRef(s.repository));
			await s.grantInOther(botRef(s.bot), s.viewer);
			await s.grantInOther(blockRef(s.repository), s.otherAdmin);
			await run(
				Effect.gen(function* () {
					yield* (yield* DB).insert(dbSchema.botSetup).values({
						botId: s.bot,
						organizationId: s.other,
						strength: "recommended",
					});
				}),
			);
			const otherBot = await s.saveBot(s.otherAdmin, {
				databaseBlockIds: [
					s.repository,
				],
			});
			const { data: chat } = await s.call(s.otherAdmin, (options) =>
				s.procedures.chat.create(
					{
						title: "Installed repository chat",
					},
					options,
				),
			);
			await s.call(s.otherAdmin, (options) =>
				s.procedures.chatBlock.attach(
					{
						chatId: chat.id,
						blockId: s.repository,
					},
					options,
				),
			);

			expect(await linkedBots(s.repository)).toEqual(
				[
					s.bot,
					otherBot,
				].sort(),
			);

			await s.setVisibility(s.author, botRef(s.bot), "private");
			expect(await installedIn(botRef(s.bot))).toEqual([]);
			expect(await activeGrantsIn(botRef(s.bot), s.other)).toEqual([]);
			expect(
				await run(
					Effect.gen(function* () {
						return yield* (yield* DB)
							.select()
							.from(dbSchema.botSetup)
							.where(eq(dbSchema.botSetup.botId, s.bot));
					}),
				),
			).toEqual([]);
			expect(
				await readTuples({
					resourceType: "bot",
					resourceId: s.bot,
					subjectId: s.viewer.user.id,
				}),
			).toEqual([]);

			await s.setVisibility(s.author, blockRef(s.repository), "private");
			expect(await installedIn(blockRef(s.repository))).toEqual([]);
			expect(await activeGrantsIn(blockRef(s.repository), s.other)).toEqual([]);
			expect(await linkedBots(s.repository)).toEqual([
				s.bot,
			]);
			expect(
				(
					await readTuples({
						resourceType: "block",
						resourceId: s.repository,
					})
				).filter((tuple) => tuple.startsWith("bot@")),
			).toEqual([
				`bot@bot:${s.bot}`,
			]);
			expect(
				await run(
					Effect.gen(function* () {
						return yield* (yield* DB)
							.select()
							.from(dbSchema.chatBlock)
							.where(eq(dbSchema.chatBlock.chatId, chat.id));
					}),
				),
			).toEqual([]);
		},
		TIMEOUT,
	);

	test(
		"keeps a document added afterwards away from the former installer",
		async () => {
			const s = await twoOrganizations();
			await s.setVisibility(s.author, blockRef(s.repository), "public");
			await s.install(blockRef(s.repository));
			await s.grantInOther(blockRef(s.repository), s.viewer);
			const findRepository = () =>
				s.call(s.viewer, (options) =>
					s.procedures.block.find(
						{
							id: s.repository,
						},
						options,
					),
				);
			expect(await reasonOf(findRepository())).toBeUndefined();

			await s.setVisibility(s.author, blockRef(s.repository), "private");
			const {
				asset: { id: assetId },
				zedToken: assetToken,
			} = await createAsset(s.author, s.home);
			s.advance(assetToken);
			await s.call(s.author, (options) =>
				s.procedures.block.update(
					{
						id: s.repository,
						type: "database",
						name: "Unlisted repository",
						description: null,
						contentJson: null,
						status: "ready",
						assets: [
							assetId,
						],
						config: {
							minReferences: 1,
							maxReferences: 5,
							defaultReferences: 3,
						},
					},
					options,
				),
			);

			expect(await reasonOf(findRepository())).toBeDefined();
			expect(
				await reasonOf(
					s.call(s.viewer, (options) =>
						s.procedures.asset.find(
							{
								id: assetId,
							},
							options,
						),
					),
				),
			).toBeDefined();
		},
		TIMEOUT,
	);
});

describe("a bot save and a block unlist", () => {
	const listedBotWithListedRepository = async () => {
		const s = await twoOrganizations();
		await s.setVisibility(s.author, botRef(s.bot), "public", [
			s.template,
			s.repository,
		]);
		const added = await s.createBlock(s.author, "database");
		await s.setVisibility(s.author, blockRef(added), "public");
		return {
			...s,
			added,
			save: () =>
				s.saveBot(s.author, {
					id: s.bot,
					templateBlockId: s.template,
					databaseBlockIds: [
						s.repository,
						added,
					],
				}),
			unlist: () => s.setVisibility(s.author, blockRef(added), "private"),
		};
	};

	test(
		"an unlist first leaves the save to confirm listing the block",
		async () => {
			const s = await listedBotWithListedRepository();
			const reasons: (string | undefined)[] = [];
			await queueBehindOrganizationLock(
				s.home,
				async () => {
					reasons[0] = await reasonOf(s.unlist());
				},
				async () => {
					reasons[1] = await reasonOf(s.save());
				},
			);

			expect(reasons).toEqual([
				undefined,
				"LISTING_BLOCKS_UNCONFIRMED",
			]);
			expect(await linkedBots(s.added)).toEqual([]);
		},
		TIMEOUT,
	);

	test(
		"a save first refuses the unlist",
		async () => {
			const s = await listedBotWithListedRepository();
			const reasons: (string | undefined)[] = [];
			await queueBehindOrganizationLock(
				s.home,
				async () => {
					reasons[0] = await reasonOf(s.save());
				},
				async () => {
					reasons[1] = await reasonOf(s.unlist());
				},
			);

			expect(reasons).toEqual([
				undefined,
				"BLOCK_USED_BY_LISTED_BOTS",
			]);
			expect(await s.visibilityOf(blockRef(s.added))).toBe("public");
		},
		TIMEOUT,
	);
});

describe("deleting the home organisation", () => {
	test(
		"names its listed resources and the organisations that added them",
		async () => {
			const s = await twoOrganizations();
			await s.setVisibility(s.author, botRef(s.bot), "public", [
				s.template,
				s.repository,
			]);
			await s.install(botRef(s.bot));
			const admin = await instanceAdmin(s.home);
			const [{ data: impact }, [other]] = await Promise.all([
				run(
					s.procedures.organization.deletionImpact(
						{
							id: s.home,
						},
						await procedureOptions(admin, s.token()),
					),
				),
				run(
					Effect.gen(function* () {
						return yield* (yield* DB)
							.select({
								name: dbSchema.organization.name,
							})
							.from(dbSchema.organization)
							.where(eq(dbSchema.organization.id, s.other));
					}),
				),
			]);

			expect(
				impact.listedResources.map((resource) => [
					resource.resourceId,
					resource.installingOrganizations,
				]),
			).toEqual(
				expect.arrayContaining([
					[
						s.bot,
						[
							other?.name,
						],
					],
					[
						s.template,
						[],
					],
					[
						s.repository,
						[],
					],
				]),
			);
			expect(impact.listedResources).toHaveLength(3);
		},
		TIMEOUT,
	);
});
