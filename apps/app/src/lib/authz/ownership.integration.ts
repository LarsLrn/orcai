import { describe, expect, test } from "bun:test";
import type {
	AssetId,
	BlockId,
	BotId,
	OrganizationId,
	OrganizationRole,
	UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { createOrganization, createUser } from "@orcai/testing";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import {
	type Actor,
	authzIntegration,
	failingWritesAbout,
	queueBehindOrganizationLock,
	rolledBack,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import { handOverItem } from "@/lib/authz/ownership";
import { AuthzService } from "@/lib/effect/services/authz";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const {
	run,
	signIn,
	organizationWith,
	procedureOptions,
	createBlock,
	createAsset,
	outboxDelivered,
	readTuples,
	instanceAdmin,
} = authzIntegration();

const rejection = (operation: Promise<unknown>) =>
	operation.then(
		() => undefined,
		(error: unknown) => error,
	);

/** Changes rows behind SpiceDB's back, so only the Postgres checks see it. */
const quietly = {
	setRole: (
		organizationId: OrganizationId,
		userId: UserId,
		role: "viewer" | "member",
	) =>
		run(
			Effect.gen(function* () {
				yield* (yield* DB)
					.update(dbSchema.member)
					.set({
						role,
					})
					.where(
						and(
							eq(dbSchema.member.organizationId, organizationId),
							eq(dbSchema.member.userId, userId),
						),
					);
			}),
		),
	ban: (userId: UserId) =>
		run(
			Effect.gen(function* () {
				yield* (yield* DB)
					.update(dbSchema.user)
					.set({
						banned: true,
					})
					.where(eq(dbSchema.user.id, userId));
			}),
		),
	makeChatUpload: (assetId: AssetId) =>
		run(
			Effect.gen(function* () {
				yield* (yield* DB)
					.update(dbSchema.asset)
					.set({
						keptIn: "chat",
					})
					.where(eq(dbSchema.asset.id, assetId));
			}),
		),
};

const keptInOf = (assetId: AssetId) =>
	run(
		Effect.gen(function* () {
			const [row] = yield* (yield* DB)
				.select({
					keptIn: dbSchema.asset.keptIn,
				})
				.from(dbSchema.asset)
				.where(eq(dbSchema.asset.id, assetId));
			return row?.keptIn;
		}),
	);

const addToLibrary = async (
	actor: Actor,
	assetId: AssetId,
	zedToken?: string,
) =>
	run(
		(await run(Procedures)).asset.addToLibrary(
			{
				id: assetId,
			},
			await procedureOptions(actor, zedToken),
		),
	);

describe("creating content", () => {
	test(
		"a Viewer or banned account in Postgres creates nothing, even while SpiceDB still allows it",
		async () => {
			const {
				organizationId,
				actors: [viewer, banned],
				zedToken,
			} = await organizationWith([
				"member",
				"member",
			]);
			await quietly.setRole(organizationId, viewer.user.id, "viewer");
			await quietly.ban(banned.user.id);

			for (const actor of [
				viewer,
				banned,
			])
				expect(await rejection(createBlock(actor, zedToken))).toMatchObject({
					reason: "PERMISSION_DENIED",
				});
		},
		TIMEOUT,
	);
});

describe("adding a chat upload to the Library", () => {
	test(
		"is refused when its owner is a Viewer or banned",
		async () => {
			const {
				organizationId,
				actors: [viewer, banned],
			} = await organizationWith([
				"member",
				"member",
			]);
			const uploads = [];
			for (const actor of [
				viewer,
				banned,
			]) {
				const { asset, zedToken } = await createAsset(actor, organizationId);
				await quietly.makeChatUpload(asset.id);
				uploads.push({
					actor,
					assetId: asset.id,
					zedToken,
				});
			}
			await quietly.setRole(organizationId, viewer.user.id, "viewer");
			await quietly.ban(banned.user.id);

			for (const { actor, assetId, zedToken } of uploads) {
				expect(
					await rejection(addToLibrary(actor, assetId, zedToken)),
				).toMatchObject({
					reason: "PERMISSION_DENIED",
				});
				expect(await keptInOf(assetId)).toBe("chat");
			}
		},
		TIMEOUT,
	);

	test(
		"queued behind the owner's removal is refused",
		async () => {
			const {
				organizationId,
				actors: [admin, owner],
				zedToken,
			} = await organizationWith([
				"admin",
				"member",
			]);
			const { asset, zedToken: assetToken } = await createAsset(
				owner,
				organizationId,
			);
			await quietly.makeChatUpload(asset.id);
			const procedures = await run(Procedures);

			await expect(
				queueBehindOrganizationLock(
					organizationId,
					async () =>
						run(
							procedures.organizationMember.delete(
								{
									refs: [
										{
											userId: owner.user.id,
										},
									],
								},
								await procedureOptions(admin, zedToken),
							),
						),
					() => addToLibrary(owner, asset.id, assetToken),
				),
			).rejects.toMatchObject({
				reason: "PERMISSION_DENIED",
			});
			expect(await keptInOf(asset.id)).toBe("chat");
		},
		TIMEOUT,
	);
});

type Options = Awaited<ReturnType<typeof procedureOptions>>;
type AppProcedures = Effect.Success<typeof Procedures>;

/** Calls a procedure as `actor`, reading at least at the newest zedToken seen. */
let token: string | undefined;
const call = async <A>(
	actor: Actor,
	operation: (
		procedures: AppProcedures,
		options: Options,
	) => Effect.Effect<
		A & {
			meta?: {
				zedToken?: string;
			};
		},
		unknown
	>,
) => {
	const result = await run(
		operation(await run(Procedures), await procedureOptions(actor, token)),
	);
	token = result.meta?.zedToken ?? token;
	return result;
};

const organization = async (roles: Parameters<typeof organizationWith>[0]) => {
	const created = await organizationWith(roles);
	token = created.zedToken ?? token;
	return created;
};

/** A new organisation with a fresh admin, which `actor` joins with `role`. */
const joining = async (actor: Actor, role: OrganizationRole) => {
	const adminUser = await run(createUser());
	const created = await run(
		createOrganization({
			members: [
				{
					userId: adminUser.id,
					role: "admin",
				},
				{
					userId: actor.user.id,
					role,
				},
			],
		}),
	);
	token = created.zedToken ?? token;
	return {
		organizationId: created.organization.id,
		admin: await signIn(created.organization.id, adminUser.id),
	};
};

type Content = {
	botId: BotId;
	blockId: BlockId;
	assetId: AssetId;
	uploadId: AssetId;
};

/** A bot, a behaviour, a Library asset and a chat upload owned by `owner`. */
const contentOf = async (
	owner: Actor,
	organizationId: OrganizationId,
): Promise<Content> => {
	const block = await createBlock(owner, token);
	token = block.zedToken ?? token;
	const { data: bot } = await call(owner, (procedures, options) =>
		procedures.bot.save(
			{
				name: "Owned bot",
				description: "Owned bot",
				status: "draft",
				templateBlockId: block.blockId,
			},
			options,
		),
	);
	const library = await createAsset(owner, organizationId);
	const upload = await createAsset(owner, organizationId);
	token = upload.zedToken ?? library.zedToken ?? token;
	await quietly.makeChatUpload(upload.asset.id);
	return {
		botId: bot.id,
		blockId: block.blockId,
		assetId: library.asset.id,
		uploadId: upload.asset.id,
	};
};

/** The owners of the content in Postgres. */
const ownersOf = (content: Content) =>
	run(
		Effect.gen(function* () {
			const db = yield* DB;
			const [bot] = yield* db
				.select({
					userId: dbSchema.bot.userId,
				})
				.from(dbSchema.bot)
				.where(eq(dbSchema.bot.id, content.botId));
			const [block] = yield* db
				.select({
					userId: dbSchema.block.userId,
				})
				.from(dbSchema.block)
				.where(eq(dbSchema.block.id, content.blockId));
			const assets = yield* db
				.select({
					id: dbSchema.asset.id,
					userId: dbSchema.asset.userId,
				})
				.from(dbSchema.asset)
				.where(
					inArray(dbSchema.asset.id, [
						content.assetId,
						content.uploadId,
					]),
				);
			const ownerOf = (id: AssetId) =>
				assets.find((asset) => asset.id === id)?.userId;
			return {
				bot: bot?.userId,
				block: block?.userId,
				asset: ownerOf(content.assetId),
				upload: ownerOf(content.uploadId),
			};
		}),
	);

/** The owner tuples SpiceDB holds for each item, once their events are delivered. */
const ownerTuplesOf = async (content: Content) => {
	const items = [
		[
			"bot",
			content.botId,
		],
		[
			"block",
			content.blockId,
		],
		[
			"asset",
			content.assetId,
		],
		[
			"asset",
			content.uploadId,
		],
	] as const;
	const tuples = [];
	for (const [resourceType, resourceId] of items) {
		await outboxDelivered(resourceId);
		tuples.push(
			(
				await readTuples({
					resourceType,
					resourceId,
				})
			).filter((tuple) => tuple.startsWith("owner@")),
		);
	}
	const [bot, block, asset, upload] = tuples;
	return {
		bot,
		block,
		asset,
		upload,
	};
};

const everything = (ownerId: UserId, uploadOwnerId: UserId | undefined) => ({
	bot: ownerId,
	block: ownerId,
	asset: ownerId,
	upload: uploadOwnerId,
});

const ownerTuples = (ownerId: UserId, uploadOwnerId: UserId) => ({
	bot: [
		`owner@user:${ownerId}`,
	],
	block: [
		`owner@user:${ownerId}`,
	],
	asset: [
		`owner@user:${ownerId}`,
	],
	upload: [
		`owner@user:${uploadOwnerId}`,
	],
});

const removeMember = (
	actor: Actor,
	userIds: readonly UserId[],
	receiverId?: UserId,
) =>
	call(actor, (procedures, options) =>
		procedures.organizationMember.delete(
			{
				refs: userIds.map((userId) => ({
					userId,
				})),
				receiverId,
			},
			options,
		),
	);

const changeRole = (
	actor: Actor,
	userId: UserId,
	role: "viewer" | "member" | "manager",
	receiverId?: UserId,
) =>
	call(actor, (procedures, options) =>
		procedures.organizationMember.update(
			{
				userId,
				role,
				receiverId,
			},
			options,
		),
	);

const handOver = (
	actor: Actor,
	resource: {
		resourceType: "bot";
		resourceId: BotId;
	},
	receiverId: UserId,
) =>
	call(actor, (procedures, options) =>
		procedures.resource.handOver(
			{
				...resource,
				receiverId,
			},
			options,
		),
	);

const isMember = (organizationId: OrganizationId, userId: UserId) =>
	run(
		Effect.gen(function* () {
			const rows = yield* (yield* DB)
				.select({
					id: dbSchema.member.id,
				})
				.from(dbSchema.member)
				.where(
					and(
						eq(dbSchema.member.organizationId, organizationId),
						eq(dbSchema.member.userId, userId),
					),
				);
			return rows.length > 0;
		}),
	);

describe("removing a member", () => {
	test(
		"hands their bots, blocks and Library assets to the receiver and leaves chat uploads",
		async () => {
			const {
				organizationId,
				actors: [admin, owner, receiver],
			} = await organization([
				"admin",
				"member",
				"member",
			]);
			const content = await contentOf(owner, organizationId);

			const { handedOver } = await removeMember(
				admin,
				[
					owner.user.id,
				],
				receiver.user.id,
			);

			expect(handedOver).toEqual({
				receiverId: receiver.user.id,
				bots: 1,
				blocks: 1,
				assets: 1,
			});
			expect(await ownersOf(content)).toEqual(
				everything(receiver.user.id, owner.user.id),
			);
			expect(await ownerTuplesOf(content)).toEqual(
				ownerTuples(receiver.user.id, owner.user.id),
			);
		},
		TIMEOUT,
	);

	test(
		"defaults to the acting member, and a member without content needs no receiver",
		async () => {
			const {
				organizationId,
				actors: [admin, owner, other],
			} = await organization([
				"admin",
				"member",
				"member",
			]);
			const content = await contentOf(owner, organizationId);

			const removed = await removeMember(admin, [
				owner.user.id,
				other.user.id,
			]);

			expect(removed.handedOver?.receiverId).toBe(admin.user.id);
			expect(await ownersOf(content)).toEqual(
				everything(admin.user.id, owner.user.id),
			);
		},
		TIMEOUT,
	);

	test(
		"fails without change for a Viewer, a banned member, a non-member, one leaving in the same call, or no receiver",
		async () => {
			const {
				organizationId,
				actors: [admin, owner, viewer, banned, leaving],
			} = await organization([
				"admin",
				"member",
				"viewer",
				"member",
				"member",
			]);
			const {
				actors: [outsider],
			} = await organization([
				"member",
			]);
			const content = await contentOf(owner, organizationId);
			await quietly.ban(banned.user.id);
			const instance = await instanceAdmin(organizationId);

			const attempts: [
				Actor,
				UserId[],
				UserId | undefined,
			][] = [
				[
					admin,
					[
						owner.user.id,
					],
					viewer.user.id,
				],
				[
					admin,
					[
						owner.user.id,
					],
					banned.user.id,
				],
				[
					admin,
					[
						owner.user.id,
					],
					outsider.user.id,
				],
				[
					admin,
					[
						owner.user.id,
						leaving.user.id,
					],
					leaving.user.id,
				],
				[
					instance,
					[
						owner.user.id,
					],
					undefined,
				],
			];
			for (const [actor, userIds, receiverId] of attempts) {
				const attempt =
					actor === instance
						? call(actor, (procedures, options) =>
								procedures.instance.removeMember(
									{
										organizationId,
										userId: owner.user.id,
									},
									options,
								),
							)
						: removeMember(actor, userIds, receiverId);
				expect(await rejection(attempt)).toMatchObject({
					reason: "RECEIVER_NOT_ELIGIBLE",
				});
			}

			expect(await ownersOf(content)).toEqual(
				everything(owner.user.id, owner.user.id),
			);
			expect(await isMember(organizationId, owner.user.id)).toBe(true);
			expect(await isMember(organizationId, leaving.user.id)).toBe(true);
		},
		TIMEOUT,
	);

	test(
		"queued before a creation by the removed member leaves them owning nothing",
		async () => {
			const {
				organizationId,
				actors: [admin, owner],
			} = await organization([
				"admin",
				"member",
			]);
			const procedures = await run(Procedures);
			const removal = async () =>
				run(
					procedures.organizationMember.delete(
						{
							refs: [
								{
									userId: owner.user.id,
								},
							],
						},
						await procedureOptions(admin, token),
					),
				);

			await expect(
				queueBehindOrganizationLock(organizationId, removal, () =>
					createBlock(owner, token),
				),
			).rejects.toMatchObject({
				reason: "PERMISSION_DENIED",
			});
			const owned = await run(
				Effect.gen(function* () {
					return yield* (yield* DB)
						.select({
							id: dbSchema.block.id,
						})
						.from(dbSchema.block)
						.where(eq(dbSchema.block.userId, owner.user.id));
				}),
			);
			expect(owned).toEqual([]);
		},
		TIMEOUT,
	);
});

describe("changing a member's role", () => {
	test(
		"to Viewer hands their content over, other changes keep it",
		async () => {
			const {
				organizationId,
				actors: [admin, owner, receiver],
			} = await organization([
				"admin",
				"member",
				"member",
			]);
			const content = await contentOf(owner, organizationId);

			const promoted = await changeRole(admin, owner.user.id, "manager");
			expect(promoted.handedOver).toBeNull();
			expect(await ownersOf(content)).toEqual(
				everything(owner.user.id, owner.user.id),
			);

			const demoted = await changeRole(
				admin,
				owner.user.id,
				"viewer",
				receiver.user.id,
			);
			expect(demoted.handedOver?.receiverId).toBe(receiver.user.id);
			expect(await ownersOf(content)).toEqual(
				everything(receiver.user.id, owner.user.id),
			);
			expect(await ownerTuplesOf(content)).toEqual(
				ownerTuples(receiver.user.id, owner.user.id),
			);
		},
		TIMEOUT,
	);
});

const chatOf = async (owner: Actor) => {
	const { data } = await call(owner, (procedures, options) =>
		procedures.chat.create(
			{
				title: "Personal",
			},
			options,
		),
	);
	return data.id;
};

describe("deleting accounts", () => {
	test(
		"hands content over per organisation, membership or not, and deletes chats and chat uploads",
		async () => {
			const {
				organizationId: first,
				actors: [firstAdmin, owner, chosen],
			} = await organization([
				"admin",
				"member",
				"member",
			]);
			const { organizationId: second, admin: secondAdmin } = await joining(
				owner,
				"member",
			);
			const firstContent = await contentOf(owner, first);
			const secondOwner = await signIn(second, owner.user.id);
			const secondContent = await contentOf(secondOwner, second);
			// An orphan an earlier removal left behind, owned without membership.
			await run(
				Effect.gen(function* () {
					yield* (yield* DB)
						.delete(dbSchema.member)
						.where(
							and(
								eq(dbSchema.member.organizationId, second),
								eq(dbSchema.member.userId, owner.user.id),
							),
						);
				}),
			);
			const chatId = await chatOf(owner);
			const instance = await instanceAdmin(first);

			await call(instance, (procedures, options) =>
				procedures.user.delete(
					{
						userIds: [
							owner.user.id,
						],
						receivers: [
							{
								organizationId: first,
								userId: chosen.user.id,
							},
						],
					},
					options,
				),
			);

			expect(await ownersOf(firstContent)).toEqual(
				everything(chosen.user.id, undefined),
			);
			expect(await ownersOf(secondContent)).toEqual(
				everything(secondAdmin.user.id, undefined),
			);
			await outboxDelivered(chatId);
			expect(
				await readTuples({
					resourceType: "chat",
					resourceId: chatId,
				}),
			).toEqual([]);
			for (const content of [
				firstContent,
				secondContent,
			]) {
				await outboxDelivered(content.uploadId);
				expect(
					await readTuples({
						resourceType: "asset",
						resourceId: content.uploadId,
					}),
				).toEqual([]);
			}
			const tuples = await ownerTuplesOf(firstContent);
			expect(tuples.bot).toEqual([
				`owner@user:${chosen.user.id}`,
			]);
			expect(firstAdmin.user.id).not.toBe(chosen.user.id);
		},
		TIMEOUT,
	);

	test(
		"keeps the grants, groups and invitations they issued, without them",
		async () => {
			const {
				organizationId,
				actors: [admin, owner, colleague],
			} = await organization([
				"admin",
				"member",
				"member",
			]);
			const { blockId, zedToken } = await createBlock(owner, token);
			token = zedToken ?? token;
			const { data: grants } = await call(owner, (procedures, options) =>
				procedures.resource.grant(
					{
						resourceType: "block",
						resourceId: blockId,
						principals: [
							{
								principalType: "user",
								principalId: colleague.user.id,
							},
						],
						role: "viewer",
					},
					options,
				),
			);
			const { group, invitation } = await run(
				Effect.gen(function* () {
					const db = yield* DB;
					const [group] = yield* db
						.insert(dbSchema.group)
						.values({
							organizationId,
							name: `Issued ${crypto.randomUUID()}`,
							kind: "custom",
							createdBy: owner.user.id,
						})
						.returning();
					yield* db.insert(dbSchema.groupMember).values({
						groupId: group.id,
						userId: colleague.user.id,
						addedBy: owner.user.id,
					});
					const [invitation] = yield* db
						.insert(dbSchema.invitation)
						.values({
							organizationId,
							email: `invited-${crypto.randomUUID()}@example.test`,
							role: "member",
							status: "pending",
							expiresAt: new Date(Date.now() + 86_400_000),
							inviterId: owner.user.id,
						})
						.returning();
					return {
						group,
						invitation,
					};
				}),
			);
			const instance = await instanceAdmin(organizationId);

			await call(instance, (procedures, options) =>
				procedures.user.delete(
					{
						userIds: [
							owner.user.id,
						],
						receivers: [],
					},
					options,
				),
			);

			const history = await run(
				Effect.gen(function* () {
					const db = yield* DB;
					const [grant] = yield* db
						.select()
						.from(dbSchema.resourceGrant)
						.where(eq(dbSchema.resourceGrant.id, grants[0].id));
					const [created] = yield* db
						.select()
						.from(dbSchema.group)
						.where(eq(dbSchema.group.id, group.id));
					const [added] = yield* db
						.select()
						.from(dbSchema.groupMember)
						.where(eq(dbSchema.groupMember.groupId, group.id));
					const [invited] = yield* db
						.select()
						.from(dbSchema.invitation)
						.where(eq(dbSchema.invitation.id, invitation.id));
					const [block] = yield* db
						.select()
						.from(dbSchema.block)
						.where(eq(dbSchema.block.id, blockId));
					return {
						grant: [
							grant.grantedBy,
							grant.revokedAt,
						],
						group: created.createdBy,
						member: added.addedBy,
						inviter: invited.inviterId,
						owner: block.userId,
					};
				}),
			);
			expect(history).toEqual({
				grant: [
					null,
					null,
				],
				group: null,
				member: null,
				inviter: null,
				owner: admin.user.id,
			});
		},
		TIMEOUT,
	);
});

describe("handing one item over", () => {
	test(
		"moves it to the receiver and leaves the previous owner Can manage",
		async () => {
			const {
				organizationId,
				actors: [owner, receiver],
			} = await organization([
				"member",
				"member",
			]);
			const content = await contentOf(owner, organizationId);
			const bot = {
				resourceType: "bot" as const,
				resourceId: content.botId,
			};

			await handOver(owner, bot, receiver.user.id);

			expect((await ownersOf(content)).bot).toBe(receiver.user.id);
			await outboxDelivered(content.botId);
			const tuples = await readTuples(bot);
			expect(tuples).toContain(`owner@user:${receiver.user.id}`);
			expect(tuples).toContain(`manager@user:${owner.user.id}`);
			expect(tuples).not.toContain(`owner@user:${owner.user.id}`);
		},
		TIMEOUT,
	);

	test(
		"only the owner hands over, not a Can manage holder or an admin",
		async () => {
			const {
				organizationId,
				actors: [owner, manager, admin, receiver],
			} = await organization([
				"member",
				"member",
				"admin",
				"member",
			]);
			const content = await contentOf(owner, organizationId);
			const bot = {
				resourceType: "bot" as const,
				resourceId: content.botId,
			};
			await call(owner, (procedures, options) =>
				procedures.resource.grant(
					{
						...bot,
						principals: [
							{
								principalType: "user",
								principalId: manager.user.id,
							},
						],
						role: "manager",
					},
					options,
				),
			);

			for (const actor of [
				manager,
				admin,
			])
				expect(
					await rejection(handOver(actor, bot, receiver.user.id)),
				).toMatchObject({
					reason: "PERMISSION_DENIED",
				});
			expect((await ownersOf(content)).bot).toBe(owner.user.id);
		},
		TIMEOUT,
	);

	test(
		"is refused from an organisation that is not the item's home",
		async () => {
			const {
				organizationId,
				actors: [owner, receiver],
			} = await organization([
				"member",
				"member",
			]);
			const content = await contentOf(owner, organizationId);
			const { organizationId: elsewhere } = await joining(owner, "member");
			// Added from the Catalogue there.
			await run(
				Effect.gen(function* () {
					yield* (yield* DB).insert(dbSchema.resourceScope).values({
						resourceType: "bot",
						resourceId: content.botId,
						organizationId: elsewhere,
						isPrimary: false,
						assignedBy: owner.user.id,
					});
				}),
			);
			const away = await signIn(elsewhere, owner.user.id);

			expect(
				await rejection(
					handOver(
						away,
						{
							resourceType: "bot",
							resourceId: content.botId,
						},
						receiver.user.id,
					),
				),
			).toMatchObject({
				reason: "PERMISSION_DENIED",
			});
			expect((await ownersOf(content)).bot).toBe(owner.user.id);
		},
		TIMEOUT,
	);

	test(
		"changes nothing when the grant or the receiver fails",
		async () => {
			const {
				organizationId,
				actors: [owner, receiver, viewer],
			} = await organization([
				"member",
				"member",
				"viewer",
			]);
			const content = await contentOf(owner, organizationId);
			const bot = {
				resourceType: "bot" as const,
				resourceId: content.botId,
			};
			const managers = () =>
				run(
					Effect.gen(function* () {
						return yield* (yield* DB)
							.select({
								id: dbSchema.resourceGrant.id,
							})
							.from(dbSchema.resourceGrant)
							.where(
								and(
									eq(dbSchema.resourceGrant.resourceId, content.botId),
									eq(dbSchema.resourceGrant.principalId, owner.user.id),
								),
							);
					}),
				);

			expect(
				await rejection(handOver(owner, bot, viewer.user.id)),
			).toMatchObject({
				reason: "RECEIVER_NOT_ELIGIBLE",
			});
			expect(await managers()).toEqual([]);

			// Without a membership the previous owner cannot hold the grant.
			await run(
				Effect.gen(function* () {
					yield* (yield* DB)
						.delete(dbSchema.member)
						.where(
							and(
								eq(dbSchema.member.organizationId, organizationId),
								eq(dbSchema.member.userId, owner.user.id),
							),
						);
				}),
			);
			expect(
				await rejection(
					run(
						handOverItem({
							resource: bot,
							actorId: owner.user.id,
							organizationId,
							receiverId: receiver.user.id,
						}),
					),
				),
			).toMatchObject({
				reason: "GRANT_PRINCIPALS_INVALID",
			});
			expect((await ownersOf(content)).bot).toBe(owner.user.id);
		},
		TIMEOUT,
	);

	test(
		"competing handovers leave exactly one owner",
		async () => {
			const {
				organizationId,
				actors: [owner, first, second],
			} = await organization([
				"member",
				"member",
				"member",
			]);
			const content = await contentOf(owner, organizationId);
			const bot = {
				resourceType: "bot" as const,
				resourceId: content.botId,
			};

			await expect(
				queueBehindOrganizationLock(
					organizationId,
					() => handOver(owner, bot, first.user.id),
					() => handOver(owner, bot, second.user.id),
				),
			).rejects.toMatchObject({
				reason: "PERMISSION_DENIED",
			});

			expect((await ownersOf(content)).bot).toBe(first.user.id);
			await outboxDelivered(content.botId);
			expect(
				(await readTuples(bot)).filter((tuple) => tuple.startsWith("owner@")),
			).toEqual([
				`owner@user:${first.user.id}`,
			]);
		},
		TIMEOUT,
	);
});

describe("handing over while SpiceDB is unavailable", () => {
	test(
		"commits in Postgres, and the next handover checks Postgres ownership",
		async () => {
			const {
				organizationId,
				actors: [owner, first, second],
			} = await organization([
				"member",
				"member",
				"member",
			]);
			const content = await contentOf(owner, organizationId);
			const bot = {
				resourceType: "bot" as const,
				resourceId: content.botId,
			};
			const spice = failingWritesAbout(content.botId, "unavailable");

			const outcome = await run(
				rolledBack(
					Effect.gen(function* () {
						const db = yield* DB;
						const handOver = (actorId: UserId, receiverId: UserId) =>
							handOverItem({
								resource: bot,
								actorId,
								organizationId,
								receiverId,
							}).pipe(
								Effect.as("handed over"),
								Effect.catch((error) =>
									Effect.succeed("reason" in error ? error.reason : error._tag),
								),
							);
						const ownerNow = () =>
							db
								.select({
									userId: dbSchema.bot.userId,
								})
								.from(dbSchema.bot)
								.where(eq(dbSchema.bot.id, content.botId))
								.pipe(Effect.map(([row]) => row?.userId));
						const pending = () =>
							db
								.select({
									id: dbSchema.authzOutbox.id,
								})
								.from(dbSchema.authzOutbox)
								.where(
									and(
										sql`${dbSchema.authzOutbox.payloadJson}::text LIKE ${`%${content.botId}%`}`,
										ne(dbSchema.authzOutbox.status, "processed"),
									),
								)
								.pipe(Effect.map((rows) => rows.map((row) => row.id)));

						const toFirst = yield* handOver(owner.user.id, first.user.id);
						const afterFirst = yield* ownerNow();
						const fromStale = yield* handOver(owner.user.id, second.user.id);
						const toSecond = yield* handOver(first.user.id, second.user.id);
						const undelivered = (yield* pending()).length;

						spice.recover();
						// Another worker may hold the delivery lock; uncommitted here, these events wait for this call.
						for (
							let attempt = 0;
							attempt < 100 && (yield* pending()).length > 0;
							attempt++
						) {
							const eventIds = yield* pending();
							yield* db
								.update(dbSchema.authzOutbox)
								.set({
									nextAttemptAt: null,
								})
								.where(inArray(dbSchema.authzOutbox.id, eventIds));
							yield* (yield* AuthzService).deliverRelationshipEvents(eventIds);
							if ((yield* pending()).length > 0)
								yield* Effect.sleep("100 millis");
						}
						return {
							toFirst,
							afterFirst,
							fromStale,
							toSecond,
							undelivered: undelivered > 0,
							final: yield* ownerNow(),
							left: (yield* pending()).length,
						};
					}),
				).pipe(Effect.provide(spice.authz)),
			).finally(spice.close);

			expect(outcome).toEqual({
				toFirst: "handed over",
				afterFirst: first.user.id,
				fromStale: "PERMISSION_DENIED",
				toSecond: "handed over",
				undelivered: true,
				final: second.user.id,
				left: 0,
			});
			expect(
				(await readTuples(bot)).filter((tuple) => tuple.startsWith("owner@")),
			).toEqual([
				`owner@user:${second.user.id}`,
			]);
		},
		TIMEOUT,
	);
});

describe("reading what members own", () => {
	test(
		"needs manage_members and stays in the active organisation",
		async () => {
			const {
				organizationId,
				actors: [admin, owner],
			} = await organization([
				"admin",
				"member",
			]);
			const {
				organizationId: elsewhere,
				actors: [stranger],
			} = await organization([
				"member",
			]);
			await contentOf(owner, organizationId);
			await contentOf(stranger, elsewhere);

			expect(
				await rejection(
					call(owner, (procedures, options) =>
						procedures.organizationMember.ownedContent(
							{
								userIds: [
									owner.user.id,
								],
							},
							options,
						),
					),
				),
			).toMatchObject({
				reason: "PERMISSION_DENIED",
			});
			const { data } = await call(admin, (procedures, options) =>
				procedures.organizationMember.ownedContent(
					{
						userIds: [
							owner.user.id,
							stranger.user.id,
						],
					},
					options,
				),
			);
			expect(data).toEqual([
				expect.objectContaining({
					organizationId,
					bots: 1,
					blocks: 1,
					assets: 1,
					defaultReceiver: expect.objectContaining({
						id: admin.user.id,
					}),
				}),
			]);
			const { data: receivers } = await call(admin, (procedures, options) =>
				procedures.organizationMember.receivers({}, options),
			);
			expect(receivers.map((receiver) => receiver.id).sort()).toEqual(
				[
					admin.user.id,
					owner.user.id,
				].sort(),
			);
			const { data: others } = await call(admin, (procedures, options) =>
				procedures.organizationMember.receivers(
					{
						excluded: [
							owner.user.id,
						],
					},
					options,
				),
			);
			expect(others.map((receiver) => receiver.id)).toEqual([
				admin.user.id,
			]);
		},
		TIMEOUT,
	);

	test(
		"an item's receivers are for its owner only",
		async () => {
			const {
				organizationId,
				actors: [owner, other],
			} = await organization([
				"member",
				"member",
			]);
			const content = await contentOf(owner, organizationId);
			const receiversOf = (actor: Actor) =>
				call(actor, (procedures, options) =>
					procedures.resource.receivers(
						{
							resourceType: "bot",
							resourceId: content.botId,
						},
						options,
					),
				);

			expect(await rejection(receiversOf(other))).toMatchObject({
				reason: "PERMISSION_DENIED",
			});
			expect((await receiversOf(owner)).data.map((user) => user.id)).toEqual([
				other.user.id,
			]);
		},
		TIMEOUT,
	);

	test(
		"a deletion defaults to the earliest admin who can sign in",
		async () => {
			const {
				organizationId,
				actors: [bannedAdmin, laterAdmin, owner],
			} = await organization([
				"admin",
				"admin",
				"member",
			]);
			await run(
				Effect.gen(function* () {
					yield* (yield* DB)
						.update(dbSchema.member)
						.set({
							createdAt: new Date(Date.now() + 60_000),
						})
						.where(
							and(
								eq(dbSchema.member.organizationId, organizationId),
								eq(dbSchema.member.userId, laterAdmin.user.id),
							),
						);
				}),
			);
			await contentOf(owner, organizationId);
			const instance = await instanceAdmin(organizationId);
			const deletionDefault = async () =>
				(
					await call(instance, (procedures, options) =>
						procedures.instance.ownedContent(
							{
								userIds: [
									owner.user.id,
								],
							},
							options,
						),
					)
				).data[0]?.defaultReceiver?.id;

			expect(await deletionDefault()).toBe(bannedAdmin.user.id);
			await quietly.ban(bannedAdmin.user.id);
			expect(await deletionDefault()).toBe(laterAdmin.user.id);
		},
		TIMEOUT,
	);
});
