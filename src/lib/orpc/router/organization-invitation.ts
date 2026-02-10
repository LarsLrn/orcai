import { ORPCError } from "@orpc/server";
import { count, eq, getColumns, inArray, or } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { dbSchema } from "@/db/schema";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";

export const listOrganizationInvitations =
	authed.organizationInvitation.list.handler(async ({ input, context }) => {
		const [data, [rowCount]] = await Promise.all([
			db
				.select({ ...getColumns(dbSchema.invitation) })
				.from(dbSchema.invitation)
				.where(
					or(
						eq(dbSchema.invitation.email, context.auth.user.email),
						eq(dbSchema.invitation.inviterId, context.auth.user.id),
					),
				)
				.limit(input.pageSize)
				.offset(input.pageIndex * input.pageSize),
			db
				.select({ count: count() })
				.from(dbSchema.invitation)
				.where(
					or(
						eq(dbSchema.invitation.email, context.auth.user.email),
						eq(dbSchema.invitation.inviterId, context.auth.user.id),
					),
				),
		]);

		return { data, rowCount: rowCount.count };
	});

export const findOrganizationInvitation = authed.organizationInvitation.find
	/* .use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				action: "read",
				entityType: "course",
			}) satisfies CheckPermissionInput,
	) */
	.handler(async ({ input }) => {
		const [query] = await db
			.select({ ...getColumns(dbSchema.invitation) })
			.from(dbSchema.invitation)
			.where(eq(dbSchema.invitation.id, input.id));

		if (!query) {
			throw new ORPCError("NOT_FOUND", { message: "Invitation not found" });
		}

		return { data: query };
	});

export const createOrganizationInvitations =
	authed.organizationInvitation.create
		.use(requireActiveOrganizationMiddleware)
		.handler(async ({ input, context }) => {
			const invitations = input.items.map((item) => ({
				email: item.email,
				organizationId: input.organizationId,
				role: input.role,
				status: "pending",
				expiresAt: input.expiresAt,
				inviterId: context.auth.user.id,
			}));

			const query = await db
				.insert(dbSchema.invitation)
				.values(invitations)
				.returning();

			return { data: query };
		});

export const updateOrganizationInvitation = authed.organizationInvitation.update
	/* .use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				action: "read",
				entityType: "organizationInvitation",
			}) satisfies CheckPermissionInput,
	) */
	.handler(async ({ input }) => {
		const [query] = await db
			.update(dbSchema.invitation)
			.set(input)
			.where(eq(dbSchema.invitation.id, input.id))
			.returning({ ...getColumns(dbSchema.invitation) });

		return { data: query };
	});

export const deleteOrganizationInvitations =
	authed.organizationInvitation.delete
		/* .use(
		checkManyPermissionMiddleware,
		(input) =>
			({
				entityIds: input.refs.map((ref) => ref.id),
				action: "delete",
				entityType: "organizationInvitation",
			}) satisfies CheckManyPermissionInput,
	) */
		.handler(async ({ input }) => {
			/* // Check if there are any IDs to delete
		if (!context.allowedIds || context.allowedIds.length === 0) {
			return { success: true, message: "No courses to delete" };
		} */

			try {
				const ids = input.refs.map((ref) => ref.id);
				await db
					.delete(dbSchema.invitation)
					.where(inArray(dbSchema.invitation.id, ids));

				return {
					success: true,
					message: "Organisation invitations deleted successfully",
				};
			} catch {
				throw new ORPCError("INTERNAL_SERVER_ERROR", {
					message: "Failed to delete organisation invitations",
				});
			}
		});

export const respondToOrganisationInvitation =
	authed.organizationInvitation.respond.handler(({ input }) => {
		const acceptInvitation = () => {
			/* const [invitation] = await db
				.select({ ...getColumns(dbSchema.invitation) })
				.from(dbSchema.invitation)
				.where(eq(dbSchema.invitation.id, input.id));

			const [invitationCourse] = await db
				.select({ organizationId: dbSchema.course.organizationId })
				.from(dbSchema.course)
				.where(eq(dbSchema.course.id, invitation.courseId))
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
				.insert(dbSchema.courseMember)
				.values({
					courseId: invitation.courseId,
					userId: context.auth.user.id,
					role: invitation.role,
					createdAt: new Date(),
				})
				.onConflictDoNothing();

			await db
				.update(dbSchema.invitation)
				.set({
					status: "accepted",
					updatedAt: new Date(),
				})
				.where(eq(dbSchema.invitation.id, input.id));

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
				.update(dbSchema.invitation)
				.set({
					status: "rejected",
					updatedAt: new Date(),
				})
				.where(eq(dbSchema.invitation.id, input.id));

			return { success: true, message: "Invitation rejected successfully" };
		};

		switch (input.response) {
			case "accept":
				return acceptInvitation();
			case "reject":
				return rejectInvitation();
			default:
				throw new ORPCError("BAD_REQUEST", {
					message: "Invalid response to organization invitation",
				});
		}
	});
