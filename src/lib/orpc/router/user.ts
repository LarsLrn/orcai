import { count, eq, getColumns } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { dbSchema } from "@/db/schema";
import { auth } from "@/lib/auth/auth";
import { DB } from "@/lib/effect/services/drizzle";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import { requirePreferencesMiddleware } from "@/lib/orpc/middlewares/auth";

export const listUsers = authed.user.list.handler(async ({ input }) =>
	runOrpcEffect(
		Effect.gen(function* () {
			const db = yield* DB;

			const [data, [rowCount]] = yield* Effect.all(
				[
					db
						.select({ ...getColumns(dbSchema.user) })
						.from(dbSchema.user)
						/* .where(inArray(course.id, entityIds)) */
						.limit(input.pageSize)
						.offset(input.pageIndex * input.pageSize),
					db.select({ count: count() }).from(dbSchema.user),
					/* .where(inArray(course.id, entityIds)) */
				],
				{ concurrency: "unbounded" },
			);

			return { data, rowCount: rowCount.count };
		}),
	),
);

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
	.handler(async ({ input, context, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const userId = input?.id ?? context.auth.user.id;

				if (userId !== context.auth.user.id) {
					return yield* Effect.fail(
						errors.FORBIDDEN({
							data: {
								allowed: false,
								action: "read",
								entityType: "user",
							},
						}),
					);
				}

				return yield* db.query.user
					.findFirst({
						where: {
							id: userId,
						},
					})
					.pipe(
						Effect.flatMap((user) =>
							Effect.fromNullable(user).pipe(
								Effect.orElse(() =>
									Effect.fail(errors.NOT_FOUND({ message: "User not found" })),
								),
							),
						),
						Effect.map((user) => ({ data: user })),
					);
			}),
		),
	);

export const updatePassword = authed.user.updatePassword.handler(
	async ({ input, context, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const ctx = yield* Effect.promise(() => auth.$context);

				const passwordMatches = yield* db.query.account
					.findFirst({
						where: {
							userId: context.auth.user.id,
							providerId: "credential",
						},
					})
					.pipe(
						Effect.flatMap((account) =>
							Effect.fromNullable(account?.password).pipe(
								Effect.orElse(() =>
									Effect.fail(
										errors.NOT_FOUND({
											message: "No password found for the user",
										}),
									),
								),
							),
						),
						Effect.flatMap((passwordHash) =>
							Effect.promise(() =>
								ctx.password.verify({
									password: input.currentPassword,
									hash: passwordHash,
								}),
							),
						),
					);

				if (!passwordMatches) {
					return yield* Effect.fail(
						errors.UNAUTHORIZED({ message: "Current password is incorrect" }),
					);
				}

				yield* Effect.promise(() => ctx.password.hash(input.password)).pipe(
					Effect.flatMap((newHash) =>
						Effect.promise(() =>
							ctx.internalAdapter.updatePassword(context.auth.user.id, newHash),
						),
					),
				);

				return { success: true };
			}),
		),
);

export const setTourState = authed.user.setTourState
	.use(requirePreferencesMiddleware)
	.handler(async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				yield* db.update(dbSchema.user).set({
					preferences: {
						...context.preferences,
						tours: {
							...context.preferences?.tours,
							[input.tourId]: input.state,
						},
					},
				});

				return { success: true };
			}),
		),
	);

// TODO: Add permission checks
export const setActiveOrganization = authed.user.setActiveOrganization.handler(
	async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				yield* db
					.update(dbSchema.session)
					.set({
						activeOrganizationId: input.organizationId,
					})
					.where(eq(dbSchema.session.id, context.auth.session.id));

				return { success: true };
			}),
		),
);
