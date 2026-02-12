import { and, count, eq, getColumns, inArray, or } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { dbSchema } from "@/db/schema";
import { DB } from "@/lib/effect/services/drizzle";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";

export const listCourseInvitations = authed.courseInvitation.list.handler(
	async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [data, [rowCount]] = yield* Effect.all(
					[
						db.query.courseInvitation.findMany({
							where: {
								OR: [
									{
										email: context.auth.user.email,
									},
									{
										inviterId: context.auth.user.id,
									},
								],
							},
							limit: input.pageSize,
							offset: input.pageIndex * input.pageSize,
						}),
						db
							.select({ count: count() })
							.from(dbSchema.courseInvitation)
							.where(
								or(
									eq(dbSchema.courseInvitation.email, context.auth.user.email),
									eq(dbSchema.courseInvitation.inviterId, context.auth.user.id),
								),
							),
					],
					{ concurrency: "unbounded" },
				);

				return { data, rowCount: rowCount.count };
			}),
		),
);

export const findCourseInvitation = authed.courseInvitation.find
	/* .use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				action: "read",
				entityType: "course",
			}) satisfies CheckPermissionInput,
	) */
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				return yield* db.query.courseInvitation
					.findFirst({
						where: {
							AND: [
								{
									id: input.id,
								},
								{
									courseId: input.courseId,
								},
							],
						},
					})
					.pipe(
						Effect.flatMap((invitation) =>
							Effect.fromNullable(invitation).pipe(
								Effect.orElse(() =>
									Effect.fail(
										errors.NOT_FOUND({ message: "Invitation not found" }),
									),
								),
							),
						),
						Effect.map((invitation) => ({ data: invitation })),
					);
			}),
		),
	);

export const createCourseInvitations = authed.courseInvitation.create
	.use(requireActiveOrganizationMiddleware)
	.handler(async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const invitations = input.items.map((item) => ({
					email: item.email,
					courseId: input.courseId,
					role: input.role,
					status: "pending",
					expiresAt: input.expiresAt,
					inviterId: context.auth.user.id,
				}));

				const data = yield* db
					.insert(dbSchema.courseInvitation)
					.values(invitations)
					.returning({ ...getColumns(dbSchema.courseInvitation) });

				return { data };
			}),
		),
	);

export const updateCourseInvitation = authed.courseInvitation.update
	/* .use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				action: "read",
				entityType: "course",
			}) satisfies CheckPermissionInput,
	) */
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [invitation] = yield* db
					.update(dbSchema.courseInvitation)
					.set(input)
					.where(
						and(
							eq(dbSchema.courseInvitation.id, input.id),
							eq(dbSchema.courseInvitation.courseId, input.courseId),
						),
					)
					.returning({ ...getColumns(dbSchema.courseInvitation) });

				return yield* Effect.fromNullable(invitation).pipe(
					Effect.orElse(() =>
						Effect.fail(
							errors.NOT_FOUND({
								message: "Course invitation not found",
								data: { id: input.id },
							}),
						),
					),
					Effect.map((data) => ({ data })),
				);
			}),
		),
	);

export const deleteCourseInvitations = authed.courseInvitation.delete
	/* .use(
		checkManyPermissionMiddleware,
		(input) =>
			({
				entityIds: input.refs.map((ref) => ref.id),
				action: "delete",
				entityType: "course",
			}) satisfies CheckManyPermissionInput,
	) */
	.handler(async ({ input }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				/* // Check if there are any IDs to delete
		if (!context.allowedIds || context.allowedIds.length === 0) {
			return { success: true, message: "No courses to delete" };
		} */

				const ids = input.refs.map((ref) => ref.id);
				yield* db
					.delete(dbSchema.courseInvitation)
					.where(
						and(
							eq(dbSchema.courseInvitation.courseId, input.courseId),
							inArray(dbSchema.courseInvitation.id, ids),
						),
					);

				return { success: true, message: "Invitations deleted successfully" };
			}),
		),
	);

export const respondToCourseInvitation =
	authed.courseInvitation.respond.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const acceptInvitation = () => {
					/* const [invitation] = await db
				.select({ ...getColumns(courseInvitation) })
				.from(courseInvitation)
				.where(eq(courseInvitation.id, input.id));

			const [invitationCourse] = await db
				.select({ organizationId: course.organizationId })
				.from(course)
				.where(eq(course.id, invitation.courseId))
				.limit(1);

			const { headers } = getWebRequest();

			const userOrganizations = await auth.api.listOrganizations({
				headers,
			});

			if (
				userOrganizations.filter(
					(org) => org.id === invitationCourse.organizationId,
				).length === 0
			) {
				await auth.api.addMember({
					body: {
						userId: context.auth.user.id,
						organizationId: invitationCourse.organizationId,
						role: "member", // TODO: Make dynamic
					},
				});
			}

			await db
				.insert(courseMember)
				.values({
					courseId: invitation.courseId,
					userId: context.auth.user.id,
					role: invitation.role,
					createdAt: new Date(),
				})
				.onConflictDoNothing();

			await db
				.update(courseInvitation)
				.set({
					status: "accepted",
					updatedAt: new Date(),
				})
				.where(eq(courseInvitation.id, input.id));

			await auth.api.setActiveOrganization({
				body: {
					organizationId: invitationCourse.organizationId,
				},
				headers,
			}); */

					return { success: true, message: "Invitation accepted successfully" };
				};

				const rejectInvitation = Effect.gen(function* () {
					yield* db
						.update(dbSchema.courseInvitation)
						.set({
							status: "rejected",
							updatedAt: new Date(),
						})
						.where(
							and(
								eq(dbSchema.courseInvitation.id, input.id),
								eq(dbSchema.courseInvitation.courseId, input.courseId),
							),
						);

					return { success: true, message: "Invitation rejected successfully" };
				});

				switch (input.response) {
					case "accept":
						return acceptInvitation();
					case "reject":
						return yield* rejectInvitation;
					default:
						return yield* Effect.fail(
							errors.BAD_REQUEST({
								message: "Invalid response to invitation",
							}),
						);
				}
			}),
		),
	);
