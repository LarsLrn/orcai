import { ORPCError } from "@orpc/server";
import { and, count, eq, getColumns } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { dbSchema } from "@/db/schema";
import { auth } from "@/lib/auth";
import { authed } from "@/lib/orpc/implementation/authed";
import { requirePreferencesMiddleware } from "@/lib/orpc/middlewares/auth";

export const listUsers = authed.user.list.handler(async ({ input }) => {
	const [data, [rowCount]] = await Promise.all([
		db
			.select({ ...getColumns(dbSchema.user) })
			.from(dbSchema.user)
			/* .where(inArray(course.id, entityIds)) */
			.limit(input.pageSize)
			.offset(input.pageIndex * input.pageSize),
		db.select({ count: count() }).from(dbSchema.user),
		/* .where(inArray(course.id, entityIds)) */
	]);

	return { data, rowCount: rowCount.count };
});

export const findUser = authed.user.find
	/* .use(
    checkPermissionMiddleware,
    (input) =>
      ({
        entityId: input.id,
        action: "read",
        entityType: "user",
      }) satisfies CheckPermissionInput,
  ) */
	.handler(async ({ input, context }) => {
		const userId = input?.id ?? context.auth.user.id;

		// TODO: Implement better permission checks
		if (userId !== context.auth.user.id) {
			throw new ORPCError("FORBIDDEN", {
				message: "You can only view your own user data",
			});
		}
		const [query] = await db
			.select({ ...getColumns(dbSchema.user) })
			.from(dbSchema.user)
			.where(eq(dbSchema.user.id, userId));

		if (!query) {
			throw new ORPCError("NOT_FOUND", { message: "User not found" });
		}

		return { data: query };
	});

export const updatePassword = authed.user.updatePassword.handler(
	async ({ input, context }) => {
		const ctx = await auth.$context;

		const [acc] = await db
			.select({ password: dbSchema.account.password })
			.from(dbSchema.account)
			.where(
				and(
					eq(dbSchema.account.userId, context.auth.user.id),
					eq(dbSchema.account.providerId, "credential"),
				),
			)
			.limit(1);

		if (!acc.password) {
			throw new ORPCError("NOT_FOUND", {
				message: "No password found for the user",
			});
		}

		const passwordMatches = await ctx.password.verify({
			password: input.currentPassword,
			hash: acc.password,
		});

		if (!passwordMatches) {
			throw new ORPCError("UNAUTHORIZED", {
				message: "Current password is incorrect",
			});
		}

		const newHash = await ctx.password.hash(input.password);

		await ctx.internalAdapter.updatePassword(context.auth.user.id, newHash);

		return { success: true };
	},
);

export const setTourState = authed.user.setTourState
	.use(requirePreferencesMiddleware)
	.handler(async ({ input, context }) => {
		await db.update(dbSchema.user).set({
			preferences: {
				...context.preferences,
				tours: {
					...context.preferences?.tours,
					[input.tourId]: input.state,
				},
			},
		});

		return { success: true };
	});

// TODO: Add permission checks
export const setActiveOrganization = authed.user.setActiveOrganization.handler(
	async ({ input, context }) => {
		await db
			.update(dbSchema.session)
			.set({
				activeOrganizationId: input.organizationId,
			})
			.where(eq(dbSchema.session.id, context.auth.session.id));

		return { success: true };
	},
);
