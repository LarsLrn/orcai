import {
	isSearchProviderKind,
	type ModelId,
	ORGANIZATION_ADMIN_ROLE,
	type OrganizationId,
	type ProviderId,
} from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	DEFAULT_INVITATION_TTL_DAYS,
	type InstanceOrganizationSortKey,
	type ModelUse,
	modelUnusableReason,
	type OrganizationSortKey,
	type UpdateOrganizationInput,
} from "@orcai/schema";
import { lookupEntitiesByPermission } from "@orcai/spice-db";
import {
	and,
	count,
	desc,
	eq,
	getColumns,
	gt,
	ilike,
	inArray,
	isNull,
	or,
} from "drizzle-orm";
import * as Effect from "effect/Effect";
import { lockAsInstanceAdmin } from "@/lib/authz/instance-admin-lock";
import {
	insertInvitations,
	wakeInvitationEmails,
} from "@/lib/authz/organization-invitations";
import {
	deleteOrganizationsWithAuthorization,
	insertOrganization,
	touchOrganizationRoles,
} from "@/lib/authz/organization-lifecycle";
import { writeRelationships } from "@/lib/authz/relationship-write";
import { getZedToken } from "@/lib/authz/zed-token";
import * as AppErrors from "@/lib/effect/utils/errors";
import { removeImage, setImage } from "@/lib/images/images";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireInstanceAdminMiddleware } from "@/lib/orpc/middlewares/auth";
import { requireEntityPermission } from "@/lib/orpc/middlewares/permission";
import { unique } from "@/lib/utils/array-utils";
import { literalSearch } from "@/lib/utils/literal-search";
import { buildOrderBy, type SortExpression } from "./helpers/sorting";

const listOrganizations = authed.organization.list.effect(function* ({
	input,
	context,
}) {
	const db = yield* DB;

	const memberships = yield* db
		.select({
			organizationId: dbSchema.member.organizationId,
			role: dbSchema.member.role,
		})
		.from(dbSchema.member)
		.where(eq(dbSchema.member.userId, context.auth.user.id));

	const allowedIds = yield* lookupEntitiesByPermission({
		userId: context.auth.user.id,
		permission: "read",
		entityType: "organization",
		zedToken: getZedToken(context),
	}).pipe(Effect.catch(() => Effect.succeed([])));

	const allowedSet = new Set(allowedIds);
	const visibleIds = unique([
		...allowedIds,
		...memberships.map((membership) => membership.organizationId),
	]);

	const missingMemberships = memberships.filter(
		(membership) => !allowedSet.has(membership.organizationId),
	);
	if (missingMemberships.length > 0) {
		yield* touchOrganizationRoles({
			userId: context.auth.user.id,
			organizationIds: missingMemberships.map(
				(membership) => membership.organizationId,
			),
		}).pipe(
			Effect.catch((error) =>
				Effect.logWarning(
					`organization.membership_repair_failed userId=${context.auth.user.id} cause=${String(error)}`,
				),
			),
		);
	}

	if (visibleIds.length === 0) {
		return {
			data: [],
			rowCount: 0,
		};
	}

	const orderBy = yield* buildOrderBy({
		sort: input.sort,
		allowlist: {
			name: dbSchema.organization.name,
			slug: dbSchema.organization.slug,
			createdAt: dbSchema.organization.createdAt,
		} satisfies Record<OrganizationSortKey, SortExpression>,
		defaultOrder: [
			desc(dbSchema.organization.createdAt),
		],
		tieBreaker: {
			id: "id",
			expression: dbSchema.organization.id,
		},
	});

	const search = input.filters?.search?.trim();
	const whereClause = and(
		inArray(dbSchema.organization.id, visibleIds),
		search
			? ilike(dbSchema.organization.name, literalSearch(search))
			: undefined,
	);

	return yield* Effect.all([
		db
			.select()
			.from(dbSchema.organization)
			.where(whereClause)
			.orderBy(...orderBy)
			.limit(input.pageSize)
			.offset(input.pageIndex * input.pageSize),
		db
			.select({
				count: count(),
			})
			.from(dbSchema.organization)
			.where(whereClause),
	]).pipe(
		Effect.map(([organizations, [countResult]]) => ({
			data: organizations,
			rowCount: countResult.count,
		})),
	);
});

const listAllOrganizations = authed.organization.listAll
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input }) {
		const db = yield* DB;
		const memberCount = count(dbSchema.member.id);

		const orderBy = yield* buildOrderBy({
			sort: input.sort,
			allowlist: {
				name: dbSchema.organization.name,
				slug: dbSchema.organization.slug,
				createdAt: dbSchema.organization.createdAt,
				memberCount,
			} satisfies Record<InstanceOrganizationSortKey, SortExpression>,
			defaultOrder: [
				desc(dbSchema.organization.createdAt),
			],
			tieBreaker: {
				id: "id",
				expression: dbSchema.organization.id,
			},
		});

		const search = input.filters?.search?.trim();
		const searchLike = search ? literalSearch(search) : undefined;
		const whereClause = searchLike
			? or(
					ilike(dbSchema.organization.name, searchLike),
					ilike(dbSchema.organization.slug, searchLike),
				)
			: undefined;

		return yield* Effect.all([
			db
				.select({
					...getColumns(dbSchema.organization),
					memberCount,
				})
				.from(dbSchema.organization)
				.leftJoin(
					dbSchema.member,
					eq(dbSchema.member.organizationId, dbSchema.organization.id),
				)
				.where(whereClause)
				.groupBy(dbSchema.organization.id)
				.orderBy(...orderBy)
				.limit(input.pageSize)
				.offset(input.pageIndex * input.pageSize),
			db
				.select({
					count: count(),
				})
				.from(dbSchema.organization)
				.where(whereClause),
		]).pipe(
			Effect.map(([organizations, [countResult]]) => ({
				data: organizations.map((organization) => ({
					...organization,
					memberCount: Number(organization.memberCount),
				})),
				rowCount: countResult.count,
			})),
		);
	});

const findOrganization = authed.organization.find
	.use(
		requireEntityPermission("organization", "read", {
			entityId: "id",
		}),
	)
	.effect(function* ({ input }) {
		const db = yield* DB;

		return yield* db.query.organization
			.findFirst({
				where: {
					id: {
						eq: input.id,
					},
				},
			})
			.pipe(
				Effect.flatMap((organization) =>
					Effect.fromNullishOr(organization).pipe(
						Effect.mapError(
							() =>
								new AppErrors.NotFoundError({
									reason: "ORGANIZATION_NOT_FOUND",
									message: "Organization not found",
								}),
						),
					),
				),
				Effect.map((organization) => ({
					data: organization,
				})),
			);
	});

const createOrganization = authed.organization.create
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input, context }) {
		const { initialAdmin, ...values } = input;
		const creator = context.auth.user;
		const { result: organization } = yield* writeRelationships(
			{
				organizationIds: [],
			},
			Effect.gen(function* () {
				// Confirms the creator is still an instance admin and holds the
				// chosen account against a concurrent ban or deletion.
				const [target] = yield* lockAsInstanceAdmin({
					actorId: creator.id,
					userIds:
						initialAdmin.kind === "user"
							? [
									initialAdmin.userId,
								]
							: [],
				});
				if (initialAdmin.kind === "user") {
					if (!target)
						return yield* Effect.fail(
							new AppErrors.NotFoundError({
								reason: "USER_NOT_FOUND",
								id: initialAdmin.userId,
								message: "User not found",
							}),
						);
					if (target.banned)
						return yield* Effect.fail(
							new AppErrors.BadRequestError({
								reason: "USER_BANNED",
								message: "A banned account cannot administer an organization.",
							}),
						);
				}

				const organization = yield* insertOrganization({
					values,
					adminUserId:
						initialAdmin.kind === "user" ? initialAdmin.userId : creator.id,
					now: new Date(),
				});
				if (initialAdmin.kind === "invite") {
					yield* insertInvitations({
						organizationId: organization.id,
						emails: [
							initialAdmin.email,
						],
						role: ORGANIZATION_ADMIN_ROLE,
						expiresAt: new Date(
							Date.now() + DEFAULT_INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000,
						),
						locale: initialAdmin.locale ?? creator.locale ?? "en",
						inviter: {
							id: creator.id,
							name: creator.name || creator.email,
						},
					});
				}
				return organization;
			}),
		);
		if (initialAdmin.kind === "invite") {
			yield* wakeInvitationEmails;
		}

		return {
			data: organization,
		};
	});

/** A model setting must name one of the organisation's own models, able to serve `use`. */
const requireUsableModel = ({
	organizationId,
	modelId,
	use,
}: {
	organizationId: OrganizationId;
	modelId: ModelId;
	use: ModelUse;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const [model] = yield* db
			.select({
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
			)
			.limit(1);

		if (!model) {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					reason: "MODEL_NOT_FOUND",
					id: modelId,
					message: "The model is not a model of this organisation.",
				}),
			);
		}

		const unusable = modelUnusableReason(model, use);
		if (unusable) {
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					reason: unusable,
					message: `The model cannot serve ${use} calls.`,
				}),
			);
		}
	});

/** The web search provider must be one of the organisation's enabled search providers. */
const requireSearchProvider = ({
	organizationId,
	providerId,
}: {
	organizationId: OrganizationId;
	providerId: ProviderId;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const [provider] = yield* db
			.select({
				kind: dbSchema.provider.kind,
				enabled: dbSchema.provider.enabled,
			})
			.from(dbSchema.provider)
			.where(
				and(
					eq(dbSchema.provider.id, providerId),
					eq(dbSchema.provider.organizationId, organizationId),
				),
			)
			.limit(1);

		if (!provider) {
			return yield* new AppErrors.NotFoundError({
				reason: "PROVIDER_NOT_FOUND",
				message: "The provider is not a provider of this organisation.",
			});
		}
		if (!isSearchProviderKind(provider.kind)) {
			return yield* new AppErrors.BadRequestError({
				reason: "PROVIDER_PURPOSE_MISMATCH",
				message: "Web search needs a search provider.",
			});
		}
		if (!provider.enabled) {
			return yield* new AppErrors.BadRequestError({
				reason: "PROVIDER_DISABLED",
				message: "The search provider is disabled.",
			});
		}
	});

/** The columns a web search update stores; the provider must be a usable search provider. */
const webSearchColumns = (
	organizationId: OrganizationId,
	webSearch: NonNullable<UpdateOrganizationInput["webSearch"]>,
) =>
	webSearch.mode === "provider"
		? requireSearchProvider({
				organizationId,
				providerId: webSearch.providerId,
			}).pipe(
				Effect.as({
					webSearchMode: webSearch.mode,
					webSearchProviderId: webSearch.providerId,
				}),
			)
		: Effect.succeed({
				webSearchMode: webSearch.mode,
				webSearchProviderId: null,
			});

const updateOrganization = authed.organization.update
	.use(
		requireEntityPermission("organization", "manage_organization", {
			entityId: "id",
		}),
	)
	.effect(function* ({ input }) {
		const db = yield* DB;

		if (input.assistantModelId) {
			yield* requireUsableModel({
				organizationId: input.id,
				modelId: input.assistantModelId,
				use: "turn",
			});
		}
		if (input.utilityModelId) {
			yield* requireUsableModel({
				organizationId: input.id,
				modelId: input.utilityModelId,
				use: "text",
			});
		}

		const { webSearch, ...fields } = input;
		const webSearchUpdate = webSearch
			? yield* webSearchColumns(input.id, webSearch)
			: {};

		return yield* db
			.update(dbSchema.organization)
			.set({
				...fields,
				...webSearchUpdate,
			})
			.where(eq(dbSchema.organization.id, input.id))
			.returning({
				...getColumns(dbSchema.organization),
			})
			.pipe(
				Effect.map(([query]) => ({
					data: query,
				})),
			);
	});

const setOrganizationLogo = authed.organization.setLogo
	.use(
		requireEntityPermission("organization", "manage_organization", {
			entityId: "id",
		}),
	)
	.effect(function* ({ input, context }) {
		const logo = yield* setImage({
			owner: {
				kind: "organization",
				organizationId: input.id,
			},
			uploaderId: context.auth.user.id,
			file: input.file,
		});

		return {
			data: {
				logo,
			},
		};
	});

const removeOrganizationLogo = authed.organization.removeLogo
	.use(
		requireEntityPermission("organization", "manage_organization", {
			entityId: "id",
		}),
	)
	.effect(function* ({ input }) {
		yield* removeImage({
			kind: "organization",
			organizationId: input.id,
		});

		return {
			success: true,
		};
	});

/** Count resources with no other active organisation scope */
const countHomeResources = (organizationId: OrganizationId) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const [result] = yield* db
			.select({
				count: count(),
			})
			.from(dbSchema.resourceScope)
			.where(
				and(
					eq(dbSchema.resourceScope.organizationId, organizationId),
					eq(dbSchema.resourceScope.isPrimary, true),
					isNull(dbSchema.resourceScope.endedAt),
				),
			);

		return Number(result?.count ?? 0);
	});

const getOrganizationDeletionImpact = authed.organization.deletionImpact
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input }) {
		const db = yield* DB;
		const now = new Date();

		const [organization] = yield* db
			.select({
				id: dbSchema.organization.id,
				name: dbSchema.organization.name,
				slug: dbSchema.organization.slug,
			})
			.from(dbSchema.organization)
			.where(eq(dbSchema.organization.id, input.id))
			.limit(1);

		if (!organization) {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					reason: "ORGANIZATION_NOT_FOUND",
					message: "Organization not found",
				}),
			);
		}

		const [[members], [pendingInvitations], [groups], homeResources] =
			yield* Effect.all(
				[
					db
						.select({
							count: count(),
						})
						.from(dbSchema.member)
						.where(eq(dbSchema.member.organizationId, input.id)),
					db
						.select({
							count: count(),
						})
						.from(dbSchema.invitation)
						.where(
							and(
								eq(dbSchema.invitation.organizationId, input.id),
								eq(dbSchema.invitation.status, "pending"),
								gt(dbSchema.invitation.expiresAt, now),
							),
						),
					db
						.select({
							count: count(),
						})
						.from(dbSchema.group)
						.where(
							and(
								eq(dbSchema.group.organizationId, input.id),
								isNull(dbSchema.group.deletedAt),
							),
						),
					countHomeResources(input.id),
				],
				{
					concurrency: "unbounded",
				},
			);

		return {
			data: {
				id: organization.id,
				name: organization.name,
				slug: organization.slug,
				members: Number(members?.count ?? 0),
				pendingInvitations: Number(pendingInvitations?.count ?? 0),
				groups: Number(groups?.count ?? 0),
				homeResources,
			},
		};
	});

const deleteOrganizations = authed.organization.delete
	.use(requireInstanceAdminMiddleware)
	.effect(function* ({ input }) {
		yield* deleteOrganizationsWithAuthorization(
			input.refs.map((ref) => ref.id),
		);

		return {
			success: true,
			message: "Organizations deleted successfully",
		};
	});

export const organizationRouter = {
	list: listOrganizations,
	listAll: listAllOrganizations,
	create: createOrganization,
	find: findOrganization,
	update: updateOrganization,
	setLogo: setOrganizationLogo,
	removeLogo: removeOrganizationLogo,
	delete: deleteOrganizations,
	deletionImpact: getOrganizationDeletionImpact,
};
