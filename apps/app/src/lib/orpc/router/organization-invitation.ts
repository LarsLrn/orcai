import { normalizeEmail } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	notificationOutboxValues,
	wakeNotificationWorker,
} from "@orcai/notifications";
import type {
	ListOrganizationInvitationsInput,
	OrganizationInvitationSortKey,
} from "@orcai/schema";
import {
	and,
	count,
	desc,
	eq,
	getColumns,
	inArray,
	or,
	type SQL,
} from "drizzle-orm";
import * as Effect from "effect/Effect";
import {
	acceptInvitation as acceptInvitedMembership,
	invitationAddressedTo,
} from "@/lib/auth/invitation-signup";
import {
	assertCanManageOrganizationAdmins,
	organizationRoleRequiresAdminControl,
} from "@/lib/authz/organization-membership";
import { getZedToken } from "@/lib/authz/zed-token";
import { AppConfigService } from "@/lib/effect/services/config";
import * as AppErrors from "@/lib/effect/utils/errors";
import { authed } from "@/lib/orpc/implementation/authed";
import { os } from "@/lib/orpc/implementation/os";
import { createProcedures } from "@/lib/orpc/implementation/procedures";
import { requireOrganizationPermission } from "@/lib/orpc/middlewares/permission";
import { buildOrderBy, type SortExpression } from "./helpers/sorting";

const invitationOrderBy = (sort: ListOrganizationInvitationsInput["sort"]) =>
	buildOrderBy({
		sort,
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

/** One page of the invitations in `scope`, with the organisation's name and slug. */
const listInvitations = (
	scope: SQL | undefined,
	input: ListOrganizationInvitationsInput,
) =>
	Effect.gen(function* () {
		const db = yield* DB;

		const whereClause = and(
			scope,
			input.filters?.status
				? eq(dbSchema.invitation.status, input.filters.status)
				: undefined,
		);

		const orderBy = yield* invitationOrderBy(input.sort);

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

const listOrganizationInvitations = authed.organizationInvitation.list
	.use(requireOrganizationPermission("invite_members"))
	.effect(function* ({ input, context }) {
		return yield* listInvitations(
			eq(
				dbSchema.invitation.organizationId,
				context.auth.session.activeOrganizationId,
			),
			input,
		);
	});

const listMyOrganizationInvitations =
	authed.organizationInvitation.listMine.effect(function* ({ input, context }) {
		return yield* listInvitations(
			invitationAddressedTo(context.auth.user.email),
			input,
		);
	});

const findOrganizationInvitation = authed.organizationInvitation.find.effect(
	function* ({ input, context }) {
		const db = yield* DB;

		const [invitation] = yield* db
			.select({
				...getColumns(dbSchema.invitation),
			})
			.from(dbSchema.invitation)
			.where(
				and(
					eq(dbSchema.invitation.id, input.id),
					or(
						invitationAddressedTo(context.auth.user.email),
						eq(dbSchema.invitation.inviterId, context.auth.user.id),
					),
				),
			)
			.limit(1);

		return yield* Effect.fromNullishOr(invitation).pipe(
			Effect.mapError(
				() =>
					new AppErrors.NotFoundError({
						reason: "INVITATION_NOT_FOUND",
						message: "Invitation not found",
					}),
			),
			Effect.map((data) => ({
				data,
			})),
		);
	},
);

const validateOrganizationInvitation =
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

const createOrganizationInvitations = authed.organizationInvitation.create
	.use(requireOrganizationPermission("invite_members"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const { config } = yield* AppConfigService;
		const organizationId = context.auth.session.activeOrganizationId;
		const organization = yield* db.query.organization.findFirst({
			where: {
				id: {
					eq: organizationId,
				},
			},
		});
		if (!organization) {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					reason: "ORGANIZATION_NOT_FOUND",
					message: "Organization not found",
				}),
			);
		}

		if (organizationRoleRequiresAdminControl(input.role)) {
			yield* assertCanManageOrganizationAdmins(organizationId, {
				userId: context.auth.user.id,
				zedToken: getZedToken(context),
			});
		}

		const invitations = input.items.map((item) => ({
			email: item.email,
			organizationId,
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
								recipientName: invitation.email.split("@")[0] || undefined,
								invitationId: invitation.id,
								organizationName: organization.name,
								inviterName: context.auth.user.name || context.auth.user.email,
								role: invitation.role,
								expiresAt: invitation.expiresAt,
								registrationUrl: `${config.auth.url}/register?inv=${invitation.id}`,
								locale: input.locale ?? context.auth.user.locale ?? "en",
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

const updateOrganizationInvitation = authed.organizationInvitation.update
	.use(requireOrganizationPermission("invite_members"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;
		const inOrganization = and(
			eq(dbSchema.invitation.id, input.id),
			eq(dbSchema.invitation.organizationId, organizationId),
		);
		const notFound = new AppErrors.NotFoundError({
			reason: "INVITATION_NOT_FOUND",
			id: input.id,
			message: "Organization invitation not found",
		});

		const invitation = yield* db.transaction((tx) =>
			Effect.gen(function* () {
				const [existing] = yield* tx
					.select({
						role: dbSchema.invitation.role,
					})
					.from(dbSchema.invitation)
					.where(inOrganization)
					.limit(1)
					.for("update");

				if (!existing) {
					return yield* Effect.fail(notFound);
				}

				if (organizationRoleRequiresAdminControl(existing.role)) {
					yield* assertCanManageOrganizationAdmins(organizationId, {
						userId: context.auth.user.id,
						zedToken: getZedToken(context),
					});
				}

				const [updated] = yield* tx
					.update(dbSchema.invitation)
					.set({
						status: input.status,
						expiresAt: input.expiresAt,
						updatedAt: new Date(),
					})
					.where(inOrganization)
					.returning({
						...getColumns(dbSchema.invitation),
					});
				return updated;
			}),
		);

		return yield* Effect.fromNullishOr(invitation).pipe(
			Effect.mapError(() => notFound),
			Effect.map((data) => ({
				data,
			})),
		);
	});

const deleteOrganizationInvitations = authed.organizationInvitation.delete
	.use(requireOrganizationPermission("invite_members"))
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const organizationId = context.auth.session.activeOrganizationId;

		const ids = input.refs.map((ref) => ref.id);
		const existingInvitations = yield* db
			.select({
				id: dbSchema.invitation.id,
				role: dbSchema.invitation.role,
			})
			.from(dbSchema.invitation)
			.where(
				and(
					eq(dbSchema.invitation.organizationId, organizationId),
					inArray(dbSchema.invitation.id, ids),
				),
			);

		if (existingInvitations.length !== ids.length) {
			return yield* Effect.fail(
				new AppErrors.NotFoundError({
					reason: "INVITATION_NOT_FOUND",
					message: "One or more organization invitations were not found",
				}),
			);
		}

		if (
			existingInvitations.some((invitation) =>
				organizationRoleRequiresAdminControl(invitation.role),
			)
		) {
			yield* assertCanManageOrganizationAdmins(organizationId, {
				userId: context.auth.user.id,
				zedToken: getZedToken(context),
			});
		}

		yield* db
			.delete(dbSchema.invitation)
			.where(
				and(
					eq(dbSchema.invitation.organizationId, organizationId),
					inArray(dbSchema.invitation.id, ids),
				),
			);

		return {
			success: true,
			message: "Organization invitations deleted successfully",
		};
	});

const respondToOrganizationInvitation =
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
									reason: "INVITATION_NOT_FOUND",
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
					reason: "INVITATION_RESPONSE_FORBIDDEN",
					message: "You are not allowed to respond to this invitation",
					data: {
						permission: "respond",
						entityType: "organizationInvitation",
					},
				}),
			);
		}

		if (invitation.expiresAt < new Date()) {
			return yield* Effect.fail(
				new AppErrors.BadRequestError({
					reason: "INVITATION_EXPIRED",
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
						reason: "INVITATION_ALREADY_ACCEPTED",
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
						reason: "INVITATION_CHANGED",
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
						reason: "INVITATION_RESPONSE_INVALID",
						message: "Invalid response to organization invitation",
					}),
				);
		}
	});

export const organizationInvitationRouter = {
	list: listOrganizationInvitations,
	listMine: listMyOrganizationInvitations,
	create: createOrganizationInvitations,
	find: findOrganizationInvitation,
	validate: validateOrganizationInvitation,
	update: updateOrganizationInvitation,
	delete: deleteOrganizationInvitations,
	respond: respondToOrganizationInvitation,
};

export const organizationInvitationProcedures = createProcedures(
	"organizationInvitation",
	organizationInvitationRouter,
);
