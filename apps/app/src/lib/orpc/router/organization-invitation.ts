import { DB, dbSchema } from "@orcai/db";
import {
	notificationOutboxValues,
	wakeNotificationWorker,
} from "@orcai/notifications";
import type { OrganizationInvitationSortKey } from "@orcai/schema";
import { and, count, desc, eq, getColumns, inArray, or } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { syncRelationshipTransition } from "@/lib/authz/relationship-transition";
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

export const listOrganizationInvitations =
	authed.organizationInvitation.list.effect(function* ({ input, context }) {
		const db = yield* DB;

		const whereClause = or(
			eq(dbSchema.invitation.email, context.auth.user.email),
			eq(dbSchema.invitation.inviterId, context.auth.user.id),
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
					.select()
					.from(dbSchema.invitation)
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
	authed.organizationInvitation.find.effect(function* ({ input }) {
		const db = yield* DB;

		return yield* db.query.invitation
			.findFirst({
				where: {
					id: {
						eq: input.id,
					},
				},
			})
			.pipe(
				Effect.flatMap((invitation) =>
					Effect.fromNullishOr(invitation).pipe(
						Effect.mapError(
							() =>
								new AppErrors.NotFoundError({
									message: "Invitation not found",
								}),
						),
					),
				),
				Effect.map((invitation) => ({
					data: invitation,
				})),
			);
	});

export const validateOrganizationInvitation =
	os.organizationInvitation.validate.effect(function* ({ input }) {
		const db = yield* DB;
		const invitation = yield* db.query.invitation.findFirst({
			where: {
				id: {
					eq: input.id,
				},
			},
		});

		if (!invitation) {
			return {
				data: {
					isValid: false,
					reason: "not_found" as const,
					email: null,
				},
			};
		}

		if (invitation.status !== "pending") {
			return {
				data: {
					isValid: false,
					reason: "consumed" as const,
					email: null,
				},
			};
		}

		if (invitation.expiresAt < new Date()) {
			return {
				data: {
					isValid: false,
					reason: "expired" as const,
					email: null,
				},
			};
		}

		return {
			data: {
				isValid: true,
				reason: null,
				email: invitation.email,
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
			invitation.email.trim().toLowerCase() !==
			context.auth.user.email.trim().toLowerCase()
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
			if (invitation.status === "rejected") {
				return yield* Effect.fail(
					new AppErrors.BadRequestError({
						message: "Rejected invitations cannot be accepted",
					}),
				);
			}

			const existingMember = yield* db.query.member.findFirst({
				where: {
					AND: [
						{
							organizationId: {
								eq: invitation.organizationId,
							},
						},
						{
							userId: {
								eq: context.auth.user.id,
							},
						},
					],
				},
			});

			if (!existingMember) {
				yield* db.insert(dbSchema.member).values({
					organizationId: invitation.organizationId,
					userId: context.auth.user.id,
					role: invitation.role ?? "member",
					createdAt: new Date(),
				});

				yield* syncRelationshipTransition({
					resourceType: "organization",
					resourceId: invitation.organizationId,
					subjectType: "user",
					subjectId: context.auth.user.id,
					newRelation: invitation.role ?? "member",
				});
			}

			if (invitation.status !== "accepted") {
				yield* db
					.update(dbSchema.invitation)
					.set({
						status: "accepted",
						updatedAt: new Date(),
					})
					.where(eq(dbSchema.invitation.id, input.id));
			}

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

			yield* db
				.update(dbSchema.invitation)
				.set({
					status: "rejected",
					updatedAt: new Date(),
				})
				.where(eq(dbSchema.invitation.id, input.id));

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
