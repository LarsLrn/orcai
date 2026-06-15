import { DB, dbSchema } from "@orcai/db";
import { and, count, eq, getColumns, inArray, or } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { syncRelationshipTransition } from "@/lib/authz/relationship-transition";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import { os } from "@/lib/orpc/implementation/os";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import {
	type CheckManyPermissionInputFor,
	checkManyPermissionMiddleware,
	requireEntityPermission,
} from "@/lib/orpc/middlewares/permission";

export const listOrganizationInvitations =
	authed.organizationInvitation.list.handler(async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [data, [rowCount]] = yield* Effect.all(
					[
						db.query.invitation.findMany({
							where: {
								OR: [
									{
										email: context.auth.user.email,
									},
									{
										inviterId: {
											eq: context.auth.user.id,
										},
									},
								],
							},
							limit: input.pageSize,
							offset: input.pageIndex * input.pageSize,
						}),
						db
							.select({
								count: count(),
							})
							.from(dbSchema.invitation)
							.where(
								or(
									eq(dbSchema.invitation.email, context.auth.user.email),
									eq(dbSchema.invitation.inviterId, context.auth.user.id),
								),
							),
					],
					{
						concurrency: "unbounded",
					},
				);

				return {
					data,
					rowCount: rowCount.count,
				};
			}),
		),
	);

export const findOrganizationInvitation =
	authed.organizationInvitation.find.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
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
								Effect.mapError(() =>
									errors.NOT_FOUND({
										message: "Invitation not found",
									}),
								),
							),
						),
						Effect.map((invitation) => ({
							data: invitation,
						})),
					);
			}),
		),
	);

export const validateOrganizationInvitation =
	os.organizationInvitation.validate.handler(async ({ input }) =>
		runOrpcEffect(
			Effect.gen(function* () {
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
						},
					};
				}

				if (invitation.status !== "pending") {
					return {
						data: {
							isValid: false,
							reason: "consumed" as const,
						},
					};
				}

				if (invitation.expiresAt < new Date()) {
					return {
						data: {
							isValid: false,
							reason: "expired" as const,
						},
					};
				}

				return {
					data: {
						isValid: true,
						reason: null,
					},
				};
			}),
		),
	);

export const createOrganizationInvitations =
	authed.organizationInvitation.create
		.use(requireActiveOrganizationMiddleware)
		.use(
			...requireEntityPermission("organization", "invite", {
				entityId: "organizationId",
			}),
		)
		.handler(async ({ input, context }) =>
			runOrpcEffect(
				Effect.gen(function* () {
					const db = yield* DB;

					const invitations = input.items.map((item) => ({
						email: item.email,
						organizationId: input.organizationId,
						role: input.role,
						status: "pending" as const,
						expiresAt: input.expiresAt,
						inviterId: context.auth.user.id,
					}));

					const data = yield* db
						.insert(dbSchema.invitation)
						.values(invitations)
						.returning({
							...getColumns(dbSchema.invitation),
						});

					return {
						data,
					};
				}),
			),
		);

export const updateOrganizationInvitation = authed.organizationInvitation.update
	.use(
		...requireEntityPermission("organization", "invite", {
			entityId: "organizationId",
		}),
	)
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
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
					Effect.mapError(() =>
						errors.NOT_FOUND({
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
			}),
		),
	);

export const deleteOrganizationInvitations =
	authed.organizationInvitation.delete
		.use(
			checkManyPermissionMiddleware("organization"),
			(input): CheckManyPermissionInputFor<"organization"> => ({
				entityIds: [
					input.organizationId,
				],
				permission: "invite",
			}),
		)
		.handler(async ({ input }) =>
			runOrpcEffect(
				Effect.gen(function* () {
					const db = yield* DB;

					const ids = input.refs.map((ref) => ref.id);
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
				}),
			),
		);

export const respondToOrganizationInvitation =
	authed.organizationInvitation.respond.handler(
		async ({ input, context, errors }) =>
			runOrpcEffect(
				Effect.gen(function* () {
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
									Effect.mapError(() =>
										errors.NOT_FOUND({
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
							errors.FORBIDDEN({
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
							errors.BAD_REQUEST({
								message: "Invitation has expired",
							}),
						);
					}

					const acceptInvitation = Effect.gen(function* () {
						if (invitation.status === "rejected") {
							return yield* Effect.fail(
								errors.BAD_REQUEST({
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
								role: invitation.role ?? "student",
								createdAt: new Date(),
							});

							yield* syncRelationshipTransition({
								resourceType: "organization",
								resourceId: invitation.organizationId,
								subjectType: "user",
								subjectId: context.auth.user.id,
								newRelation: invitation.role ?? "student",
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
								errors.BAD_REQUEST({
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
								errors.BAD_REQUEST({
									message: "Invalid response to organization invitation",
								}),
							);
					}
				}),
			),
	);
