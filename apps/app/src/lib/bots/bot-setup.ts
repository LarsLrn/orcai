import type {
	BotId,
	GroupId,
	ModelId,
	OrganizationId,
	UserId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { coveringGroups } from "@orcai/quota";
import {
	type BotSetup,
	type BotSetupCoverage,
	type BotSetupFields,
	modelUnusableReason,
} from "@orcai/schema";
import { permittedEntityIds } from "@orcai/spice-db";
import { and, eq, inArray, isNull } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { visibleGroupScope } from "@/lib/authz/group-visibility";
import { activeGrants } from "@/lib/authz/resource-access";
import { checkChatModel, checkMaxTokens } from "@/lib/chats/chat-model";
import * as AppErrors from "@/lib/effect/utils/errors";
import { canSeeEmailIn } from "@/lib/orpc/router/helpers/can-see-email";

type SetupKey = {
	botId: BotId;
	organizationId: OrganizationId;
};

/**
 * Whether the user edits the bot's setup in the organisation: they edit the
 * bot and the organisation is its home.
 */
export const canEditBotSetup = ({
	botId,
	organizationId,
	userId,
	zedToken,
}: SetupKey & {
	userId: UserId;
	zedToken?: string;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const [editable, [home]] = yield* Effect.all(
			[
				permittedEntityIds({
					entityIds: [
						botId,
					],
					entityType: "bot",
					permission: "edit",
					userId,
					zedToken,
				}),
				db
					.select({
						id: dbSchema.resourceScope.id,
					})
					.from(dbSchema.resourceScope)
					.where(
						and(
							eq(dbSchema.resourceScope.resourceType, "bot"),
							eq(dbSchema.resourceScope.resourceId, botId),
							eq(dbSchema.resourceScope.organizationId, organizationId),
							eq(dbSchema.resourceScope.isPrimary, true),
							isNull(dbSchema.resourceScope.endedAt),
						),
					),
			],
			{
				concurrency: "unbounded",
			},
		);
		return editable.has(botId) && home !== undefined;
	});

/** Fails unless the user edits the bot's setup in the organisation. */
export const requireBotSetupEditor = (
	params: Parameters<typeof canEditBotSetup>[0],
) =>
	canEditBotSetup(params).pipe(
		Effect.filterOrFail(
			(allowed) => allowed,
			() =>
				new AppErrors.ForbiddenError({
					reason: "BOT_SETUP_FORBIDDEN",
					message:
						"Only editors of the bot in its home organisation change its setup there.",
				}),
		),
		Effect.asVoid,
	);

/** The bot's setup in the organisation, or null when its chats pick freely. */
export const findBotSetup = ({ botId, organizationId }: SetupKey) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const [row] = yield* db
			.select({
				strength: dbSchema.botSetup.strength,
				generation: dbSchema.botSetup.generation,
				model: {
					id: dbSchema.model.id,
					name: dbSchema.model.name,
					providerId: dbSchema.model.providerId,
					capabilities: dbSchema.model.capabilities,
					isDeprecated: dbSchema.model.isDeprecated,
				},
				providerEnabled: dbSchema.provider.enabled,
			})
			.from(dbSchema.botSetup)
			.leftJoin(
				dbSchema.model,
				eq(dbSchema.model.id, dbSchema.botSetup.modelId),
			)
			.leftJoin(
				dbSchema.provider,
				eq(dbSchema.provider.id, dbSchema.model.providerId),
			)
			.where(
				and(
					eq(dbSchema.botSetup.botId, botId),
					eq(dbSchema.botSetup.organizationId, organizationId),
				),
			);

		if (!row) return null;
		const { model, providerEnabled } = row;
		return {
			model: model && {
				id: model.id,
				name: model.name,
				providerId: model.providerId,
				usable:
					modelUnusableReason(
						{
							capabilities: model.capabilities,
							isDeprecated: model.isDeprecated,
							providerEnabled: providerEnabled ?? false,
						},
						"turn",
					) === undefined,
			},
			strength: row.strength,
			generation: row.generation,
		} satisfies BotSetup;
	});

/** The model of the organisation with what decides whether a turn can use it. */
const organizationModel = ({
	modelId,
	organizationId,
}: {
	modelId: ModelId;
	organizationId: OrganizationId;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const [model] = yield* db
			.select({
				providerId: dbSchema.model.providerId,
				capabilities: dbSchema.model.capabilities,
				isDeprecated: dbSchema.model.isDeprecated,
				providerEnabled: dbSchema.provider.enabled,
			})
			.from(dbSchema.model)
			.innerJoin(
				dbSchema.provider,
				eq(dbSchema.provider.id, dbSchema.model.providerId),
			)
			.where(
				and(
					eq(dbSchema.model.id, modelId),
					eq(dbSchema.provider.organizationId, organizationId),
				),
			);

		if (!model) {
			return yield* new AppErrors.NotFoundError({
				reason: "MODEL_NOT_FOUND",
				id: modelId,
				message: "Model not found",
			});
		}
		return model;
	});

/**
 * Stores the bot's setup in the organisation, or removes it with null. The
 * model must belong to the organisation and serve turns, and the generation
 * settings must fit it; the provider follows from the model.
 */
export const saveBotSetup = ({
	botId,
	organizationId,
	userId,
	setup,
}: SetupKey & {
	userId: UserId;
	setup: BotSetupFields | null;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const key = and(
			eq(dbSchema.botSetup.botId, botId),
			eq(dbSchema.botSetup.organizationId, organizationId),
		);

		if (setup === null) {
			yield* db.delete(dbSchema.botSetup).where(key);
			return null;
		}

		const model = yield* organizationModel({
			modelId: setup.modelId,
			organizationId,
		});
		yield* checkChatModel({
			providerId: model.providerId,
			modelId: setup.modelId,
			organizationId,
		});
		const unusable = modelUnusableReason(model, "turn");
		if (unusable) {
			return yield* new AppErrors.BadRequestError({
				reason: unusable,
				message: "The model cannot serve chats.",
			});
		}
		yield* checkMaxTokens({
			modelId: setup.modelId,
			maxTokens: setup.generation.maxTokens,
			organizationId,
		});

		const values = {
			modelId: setup.modelId,
			strength: setup.strength,
			generation: setup.generation,
			updatedBy: userId,
			updatedAt: new Date(),
		};
		yield* db
			.insert(dbSchema.botSetup)
			.values({
				botId,
				organizationId,
				...values,
			})
			.onConflictDoUpdate({
				target: [
					dbSchema.botSetup.botId,
					dbSchema.botSetup.organizationId,
				],
				set: values,
			});

		return yield* findBotSetup({
			botId,
			organizationId,
		});
	});

/**
 * Whether each principal the bot is shared with in the organisation has a
 * quota pool for the model: a group through its own pool or All Members, a
 * user through a group of theirs or All Members. Shows only the groups the
 * viewer may see, with emails only to those who manage groups.
 */
export const botSetupCoverage = ({
	botId,
	organizationId,
	modelId,
	viewer,
}: SetupKey & {
	modelId: ModelId;
	viewer: {
		userId: UserId;
		zedToken?: string;
	};
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const model = yield* organizationModel({
			modelId,
			organizationId,
		});
		const grants = yield* activeGrants(
			{
				resourceType: "bot",
				resourceId: botId,
			},
			organizationId,
		);
		const userIds = grants.flatMap((grant) =>
			grant.principalType === "user"
				? [
						grant.principalId as UserId,
					]
				: [],
		);
		const groupIds = grants.flatMap((grant) =>
			grant.principalType === "group"
				? [
						grant.principalId as GroupId,
					]
				: [],
		);

		const [groups, users, covering] = yield* Effect.all(
			[
				groupIds.length === 0
					? Effect.succeed([])
					: Effect.gen(function* () {
							const visible = yield* visibleGroupScope({
								...viewer,
								organizationIds: [
									organizationId,
								],
							});
							return yield* db
								.select({
									id: dbSchema.group.id,
									name: dbSchema.group.name,
									description: dbSchema.group.description,
									kind: dbSchema.group.kind,
									systemKey: dbSchema.group.systemKey,
									organizationId: dbSchema.group.organizationId,
								})
								.from(dbSchema.group)
								.where(
									and(
										inArray(dbSchema.group.id, groupIds),
										eq(dbSchema.group.organizationId, organizationId),
										isNull(dbSchema.group.deletedAt),
										visible,
									),
								);
						}),
				userIds.length === 0
					? Effect.succeed([])
					: Effect.gen(function* () {
							const canSeeEmail = yield* canSeeEmailIn({
								...viewer,
								organizationIds: [
									organizationId,
								],
							});
							return yield* db
								.select({
									id: dbSchema.user.id,
									name: dbSchema.user.name,
									email: dbSchema.user.email,
									image: dbSchema.user.image,
								})
								.from(dbSchema.user)
								.innerJoin(
									dbSchema.member,
									and(
										eq(dbSchema.member.userId, dbSchema.user.id),
										eq(dbSchema.member.organizationId, organizationId),
									),
								)
								.where(inArray(dbSchema.user.id, userIds))
								.pipe(
									Effect.map((rows) =>
										rows.map(({ email, ...user }) =>
											canSeeEmail
												? {
														...user,
														email,
													}
												: user,
										),
									),
								);
						}),
				coveringGroups({
					organizationId,
					providerId: model.providerId,
					modelId,
				}),
			],
			{
				concurrency: "unbounded",
			},
		);

		const coveredUserIds = new Set<string>();
		if (
			!covering.allMembers &&
			covering.groupIds.size > 0 &&
			users.length > 0
		) {
			const memberships = yield* db
				.select({
					userId: dbSchema.groupMember.userId,
				})
				.from(dbSchema.groupMember)
				.where(
					and(
						inArray(
							dbSchema.groupMember.userId,
							users.map((user) => user.id),
						),
						inArray(dbSchema.groupMember.groupId, [
							...covering.groupIds,
						]),
						isNull(dbSchema.groupMember.removedAt),
					),
				);
			for (const membership of memberships) {
				coveredUserIds.add(membership.userId);
			}
		}

		return {
			principals: [
				...groups.map((group) => ({
					principal: {
						type: "group" as const,
						...group,
					},
					covered: covering.allMembers || covering.groupIds.has(group.id),
				})),
				...users.map((user) => ({
					principal: {
						type: "user" as const,
						...user,
					},
					covered: covering.allMembers || coveredUserIds.has(user.id),
				})),
			],
		} satisfies BotSetupCoverage;
	});
