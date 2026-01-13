import { ORPCError } from "@orpc/server";
import { count, eq, getTableColumns, inArray, or } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { courseInvitation } from "@/db/schema/course-invitation";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";

export const listCourseInvitations = authed.courseInvitation.list.handler(
	async ({ input, context }) => {
		/* const { entityIds } = await listAllowedEntities({
      entityType: "invitation",
      action: "read",
      userId: context.auth.user.id,
    }); */

		const [data, [rowCount]] = await Promise.all([
			db
				.select({ ...getTableColumns(courseInvitation) })
				.from(courseInvitation)
				.where(
					or(
						eq(courseInvitation.email, context.auth.user.email),
						eq(courseInvitation.inviterId, context.auth.user.id),
					),
				)
				.limit(input.pageSize)
				.offset(input.pageIndex * input.pageSize),
			db
				.select({ count: count() })
				.from(courseInvitation)
				.where(
					or(
						eq(courseInvitation.email, context.auth.user.email),
						eq(courseInvitation.inviterId, context.auth.user.id),
					),
				),
		]);

		return { data, rowCount: rowCount.count };
	},
);

export const findCourseInvitation = authed.courseInvitation.find
	/* .use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				action: "read",
				entityType: "course",
			}) as const,
	) */
	.handler(async ({ input }) => {
		const [query] = await db
			.select({ ...getTableColumns(courseInvitation) })
			.from(courseInvitation)
			.where(eq(courseInvitation.id, input.id));

		if (!query) {
			throw new ORPCError("NOT_FOUND", { message: "Invitation not found" });
		}

		return { data: query };
	});

export const createCourseInvitations = authed.courseInvitation.create
	.use(requireActiveOrganizationMiddleware)
	.handler(async ({ input, context }) => {
		const invitations = input.items.map((item) => ({
			email: item.email,
			courseId: input.courseId,
			role: input.role,
			status: "pending",
			expiresAt: input.expiresAt,
			inviterId: context.auth.user.id,
		}));

		const query = await db
			.insert(courseInvitation)
			.values(invitations)
			.returning();

		/* await createRelation({
			entityId: query.id,
			entityType: "course",
			userId: context.auth.user.id,
			relation: "owner",
		}); */

		return { data: query };
	});

export const updateCourseInvitation = authed.courseInvitation.update
	/* .use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				action: "read",
				entityType: "course",
			}) as const,
	) */
	.handler(async ({ input }) => {
		const [query] = await db
			.update(courseInvitation)
			.set(input)
			.where(eq(courseInvitation.id, input.id))
			.returning({ ...getTableColumns(courseInvitation) });

		return { data: query };
	});

export const deleteCourseInvitations = authed.courseInvitation.delete
	/* .use(
		checkManyPermissionMiddleware,
		(input) =>
			({
				entityIds: input.refs.map((ref) => ref.id),
				action: "delete",
				entityType: "course",
			}) as const,
	) */
	.handler(async ({ input }) => {
		/* // Check if there are any IDs to delete
		if (!context.allowedIds || context.allowedIds.length === 0) {
			return { success: true, message: "No courses to delete" };
		} */

		try {
			const ids = input.refs.map((ref) => ref.id);
			await db
				.delete(courseInvitation)
				.where(inArray(courseInvitation.id, ids));

			return { success: true, message: "Invitations deleted successfully" };
		} catch (error) {
			console.error("Error deleting invitations:", error);
			throw new ORPCError("INTERNAL_SERVER_ERROR", {
				message: "Failed to delete invitations",
			});
		}
	});

export const respondToCourseInvitation =
	authed.courseInvitation.respond.handler(({ input }) => {
		const acceptInvitation = () => {
			/* const [invitation] = await db
				.select({ ...getTableColumns(courseInvitation) })
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

		const rejectInvitation = async () => {
			await db
				.update(courseInvitation)
				.set({
					status: "rejected",
					updatedAt: new Date(),
				})
				.where(eq(courseInvitation.id, input.id));

			return { success: true, message: "Invitation rejected successfully" };
		};

		switch (input.response) {
			case "accept":
				return acceptInvitation();
			case "reject":
				return rejectInvitation();
			default:
				throw new ORPCError("BAD_REQUEST", {
					message: "Invalid response to invitation",
				});
		}
	});
