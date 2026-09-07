import { normalizeEmail, type UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	notificationOutboxValues,
	wakeNotificationWorker,
} from "@orcai/notifications";
import type { OrganizationInvitationSortKey } from "@orcai/schema";
import { and, count, desc, eq, getColumns, inArray, or } from "drizzle-orm";
import * as Effect from "effect/Effect";
import {
	acceptInvitation as acceptInvitedMembership,
	invitationAddressedTo,
} from "@/lib/auth/invitation-signup";
import { AppConfigService } from "@/lib/effect/services/config";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { os } from "@/lib/orpc/implementation/os";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import {
	type CheckManyPermissionInputFor,
	checkManyPermissionMiddleware,
	requireEntityPermission,
} from "@/lib/orpc/middlewares/permission";
import {
	assertCanManageOrganizationAdmins,
	organizationRoleRequiresAdminControl,
} from "./helpers/organization-role-policy";
import { buildOrderBy, type SortExpression } from "./helpers/sorting";

/** Invitations the caller was sent or sent themselves. */
const invitationScope = (user: { id: UserId; email: string }) =>
	or(
		invitationAddressedTo(user.email),
		eq(dbSchema.invitation.inviterId, user.id),
	);

export const listOrganizationInvitations =
	authed.organizationInvitation.list.effect(function* ({ input, context }) {
		const db = yield* DB;

		const baseScopeClause =
			input.filters?.recipient === "me"
				? invitationAddressedTo(context.auth.user.email)
				: invitationScope(context.auth.user);

		const whereClause = and(
			baseScopeClause,
			input.organizationId
				? eq(dbSchema.invitation.organizationId, input.organizationId)
				: undefined,
			input.filters?.status
				? eq(dbSchema.invitation.status, input.filters.status)
				: undefined,
		);

		const orderBy = yield* buildOrderBy({
			sort: input.sort,
			allowlist: {
				email: dbSchema.invitation.email,
				id: dbSchema.invitation.id,
				expiresAt: dbSchema.invitation.expiresAt,
				status: dbSchema.invitation.status,
				role: dbSchema.invitation.role,
				createdAt: dbSchema.invitation.createdAt,
			} satisfies Record<OrganizationInvitationSortKey, SortExpression>,
			defaultOrder: [
				desc(dbSchema.invitation.createdAt),
			],
			tieBreaker: {
				id: "id",
				expression: dbSchema.invitation.id,
			},
		});

		const [data, [rowCount]] = yield* Effect.all(
			[
				db
					.select({
						...getColumns(dbSchema.invitation),
						organizationName: dbSchema.organization.name,
						organizationSlug: dbSchema.organization.slug,
					})
					.from(dbSchema.invitation)
					.innerJoin(
						dbSchema.organization,
						eq(dbSchema.organization.id, dbSchema.invitation.organizationId),
					)
					.where(whereClause)
					.orderBy(...orderBy)
					.limit(input.pageSize)
					.offset(input.pageIndex * input.pageSize),
				db
					.select({
						count: count(),
					})
					.from(dbSchema.invitation)
					.where(whereClause),
			],
			{
				concurrency: "unbounded",
			},
		);

		return {
			data,
			rowCount: rowCount.count,
		};
	});

export const findOrganizationInvitation =
	authed.organizationInvitation.find.effect(function* ({ input, context }) {
		const db = yield* DB;

		const [invitation] = yield* db
			.select({
				...getColumns(dbSchema.invitation),
			})
			.from(dbSchema.invitation)
			.where(
				and(
					eq(dbSchema.invitation.id, input.id),
					invitationScope(context.auth.user),
				),
			)
			.limit(1);

		return yield* Effect.fromNullishOr(invitation).pipe(
			Effect.mapError(
				() =>
					new AppErrors.NotFoundError({
						message: "Invitation not found",
					}),
			),
			Effect.map((data) => ({
				data,
			})),
		);
	});

export const validateOrganizationInvitation =
	os.organizationInvitation.validate.effect(function* ({ input }) {
		const db = yield* DB;

		const [row] = yield* db
			.select({
				...getColumns(dbSchema.invitation),
				organizationName: dbSchema.organization.name,
				organizationSlug: dbSchema.organization.slug,
			})
			.from(dbSchema.invitation)
			.innerJoin(
				dbSchema.organization,
				eq(dbSchema.organization.id, dbSchema.invitation.organizationId),
			)
			.where(eq(dbSchema.invitation.id, input.id))
			.limit(1);

		const invalid = (
			reason: "not_found" | "consumed" | "expired",
		): {
			data: {
				isValid: false;
				reason: typeof reason;
				email: null;
				organizationName: null;
				organizationSlug: null;
			};
		} => ({
			data: {
				isValid: false,
				reason,
				email: null,
				organizationName: null,
				organizationSlug: null,
			},
		});

		if (!row) {
			return invalid("not_found");
		}

		if (row.status !== "pending") {
			return invalid("consumed");
		}

		if (row.expiresAt < new Date()) {
			return invalid("expired");
		}

		return {
			data: {
				isValid: true,
				reason: null,
				email: row.email,
				organizationName: row.organizationName,
				organizationSlug: row.organizationSlug,
			},
		};
	});

export const createOrganizationInvitations =
	authed.organizationInvitation.create
		.use(requireActiveOrganizationMiddleware)
		.use(
			requireEntityPermission("organization", "invite_members", {
				entityId: "organizationId",
			}),
		)
		.effect(function* ({ input, context }) {
			const db = yield* DB;
			const { config } = yield* AppConfigService;
			const organization = yield* db.query.organization.findFirst({
				where: {
					id: {
						eq: input.organizationId,
					},
				},
			});
			if (!organization) {
				return yield* Effect.fail(
					new AppErrors.NotFoundError({
						message: "Organization not found",
					}),
				);
			}

			if (organizationRoleRequiresAdminControl(input.role)) {
				yield* assertCanManageOrganizationAdmins({
					organizationId: input.organizationId,
					userId: context.auth.user.id,
				});
			}

			const invitations = input.items.map((item) => ({
				email: item.email,
				organizationId: input.organizationId,
				role: input.role,
				status: "pending" as const,
				expiresAt: input.expiresAt,
				inviterId: context.auth.user.id,
			}));

			const data = yield* db.transaction((tx) =>
				Effect.gen(function* () {
					const created = yield* tx
						.insert(dbSchema.invitation)
						.values(invitations)
						.returning({
							...getColumns(dbSchema.invitation),
						});
					yield* tx.insert(dbSchema.notificationOutbox).values(
						created.map((invitation) =>
							notificationOutboxValues(
								{
									type: "organization.invited",
									recipient: invitation.email,
									recipientName: invitation.email.split("@")[0] || "there",
									invitationId: invitation.id,
									organizationName: organization.name,
									inviterName:
										context.auth.user.name || context.auth.user.email,
									role: invitation.role,
									expiresAt: invitation.expiresAt,
									registrationUrl: `${config.auth.url}/register?inv=${invitation.id}`,
								},
								`organization.invited:${invitation.id}`,
							),
						),
					);
					return created;
				}),
			);
			yield* wakeNotificationWorker.pipe(
				Effect.catch((cause) =>
					Effect.logWarning(`notification.wake.failed cause=${String(cause)}`),
				),
			);

			return {
				data,
			};
		});

export const updateOrganizationInvitation = authed.organizationInvitation.update
	.use(
		requireEntityPermission("organization", "invite_members", {
			entityId: "organizationId",
		}),
	)
	.effect(function* ({ input }) {
		const db = yield* DB;

		const [invitation] = yield* db
			.update(dbSchema.invitation)
			.set({
				status: input.status,
				expiresAt: input.expiresAt,
				updatedAt: new Date(),
			})
			.where(
				and(
					eq(dbSchema.invitation.id, input.id),
					eq(dbSchema.invitation.organizationId, input.organizationId),
				),
			)
			.returning({
				...getColumns(dbSchema.invitation),
			});

		return yield* Effect.fromNullishOr(invitation).pipe(
			Effect.mapError(
				() =>
					new AppErrors.NotFoundError({
						message: "Organization invitation not found",
						data: {
							id: input.id,
						},
					}),
			),
			Effect.map((data) => ({
				data,
			})),
		);
	});

export const deleteOrganizationInvitations =
	authed.organizationInvitation.delete
		.use(
			checkManyPermissionMiddleware("organization").adaptInput(
				(input): CheckManyPermissionInputFor<"organization"> => ({
					entityIds: [
						input.organizationId,
					],
					permission: "invite_members",
				}),
			),
		)
		.effect(function* ({ input }) {
			const db = yield* DB;

			const ids = input.refs.map((ref) => ref.id);
			const existingInvitations = yield* db
				.select({
					id: dbSchema.invitation.id,
				})
				.from(dbSchema.invitation)
				.where(
					and(
						eq(dbSchema.invitation.organizationId, input.organizationId),
						inArray(dbSchema.invitation.id, ids),
					),
				);

			if (existingInvitations.length !== ids.length) {
				return yield* Effect.fail(
					new AppErrors.NotFoundError({
						message: "One or more organization invitations were not found",
					}),
				);
			}

			yield* db
				.delete(dbSchema.invitation)
				.where(
					and(
						eq(dbSchema.invitation.organizationId, input.organizationId),
						inArray(dbSchema.invitation.id, ids),
					),
				);

			return {
				success: true,
				message: "Organization invitations deleted successfully",
			};
		});

export const respondToOrganizationInvitation =
	authed.organizationInvitation.respond.effect(function* ({ input, context }) {
		const db = yield* DB;

		const invitation = yield* db.query.invitation
			.findFirst({
				where: {
					id: {
						eq: input.id,
					},
				},
			})
			.pipe(
				Effect.flatMap((result) =>
					Effect.fromNullishOr(result).pipe(
						Effect.mapError(
							() =>
								new AppErrors.NotFoundError({
									message: "Organization invitation not found",
								}),
						),
					),
				),
			);

		if (
			normalizeEmail(invitation.email) !==
			normalizeEmail(context.auth.user.email)
		) {
			return yield* Effect.fail(
				new AppErrors.ForbiddenError({
					message: "You are not allowed to respond to this invitation",
					data: {
						allowed: false,
						permission: "respond",
						entityType: "organizationInvitation",
					},
				}),
			);
		}

		if (invitation.expiresAt < new Date()) {
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					message: "Invitation has expired",
				}),
			);
		}

		const acceptInvitation = Effect.gen(function* () {
			yield* acceptInvitedMembership({
				userId: context.auth.user.id,
				email: context.auth.user.email,
				invitationId: input.id,
			});

			if (!context.auth.session.activeOrganizationId) {
				yield* db
					.update(dbSchema.session)
					.set({
						activeOrganizationId: invitation.organizationId,
					})
					.where(eq(dbSchema.session.id, context.auth.session.id));
			}

			return {
				success: true,
				message: "Invitation accepted successfully",
			};
		});

		const rejectInvitation = Effect.gen(function* () {
			if (invitation.status === "accepted") {
				return yield* Effect.fail(
					new AppErrors.BadRequestError({
						message: "Accepted invitations cannot be rejected",
					}),
				);
			}

			const rejected = yield* db
				.update(dbSchema.invitation)
				.set({
					status: "rejected",
					updatedAt: new Date(),
				})
				.where(
					and(
						eq(dbSchema.invitation.id, input.id),
						eq(dbSchema.invitation.status, invitation.status),
					),
				)
				.returning({
					id: dbSchema.invitation.id,
				});
			if (rejected.length === 0)
				return yield* Effect.fail(
					new AppErrors.BadRequestError({
						message: "Invitation changed while responding",
					}),
				);

			return {
				success: true,
				message: "Invitation rejected successfully",
			};
		});

		switch (input.response) {
			case "accept":
				return yield* acceptInvitation;
			case "reject":
				return yield* rejectInvitation;
			default:
				return yield* Effect.fail(
					new AppErrors.BadRequestError({
						message: "Invalid response to organization invitation",
					}),
				);
		}
	});
