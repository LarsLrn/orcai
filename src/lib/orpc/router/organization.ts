import { count, eq, getColumns, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { dbSchema } from "@/db/schema";
import { DB } from "@/lib/effect/services/drizzle";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import {
	type CheckManyPermissionInput,
	checkManyPermissionMiddleware,
} from "@/lib/orpc/middlewares/permission";
import { client } from "@/lib/orpc/orpc";

export const listOrganizations = authed.organization.list.handler(
	async ({ input }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				return yield* Effect.all([
					db.query.organization.findMany({
						limit: input.pageSize,
						offset: input.pageIndex * input.pageSize,
					}),
					db.select({ count: count() }).from(dbSchema.organization),
				]).pipe(
					Effect.map(([organizations, [countResult]]) => ({
						data: organizations,
						rowCount: countResult.count,
					})),
				);
			}),
		),
);

export const findOrganization = authed.organization.find
	/* .use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				action: "read",
				entityType: "organization",
			}) satisfies CheckPermissionInput,
	) */
	.handler(async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				return yield* db.query.organization
					.findFirst({
						where: {
							id: input.id,
						},
					})
					.pipe(
						Effect.flatMap((organization) =>
							Effect.fromNullable(organization).pipe(
								Effect.orElse(() =>
									Effect.fail(
										errors.NOT_FOUND({ message: "Organization not found" }),
									),
								),
							),
						),
						Effect.map((chat) => ({ data: chat })),
					);
			}),
		),
	);

export const createOrganization = authed.organization.create
	.use(requireActiveOrganizationMiddleware)
	.handler(async ({ input, context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [newOrganization] = yield* db
					.insert(dbSchema.organization)
					.values({ ...input, createdAt: new Date() })
					.returning({ ...getColumns(dbSchema.organization) });

				const newOrganizationMember = client.organizationMember.create({
					organizationId: newOrganization.id,
					userId: context.auth.user.id,
					role: "owner",
				});

				return { data: newOrganization, relation: newOrganizationMember };
			}),
		),
	);

export const updateOrganization = authed.organization.update
	/* .use(
		checkPermissionMiddleware,
		(input) =>
			({
				entityId: input.id,
				action: "read",
				entityType: "organization",
			}) satisfies CheckPermissionInput,
	) */
	.handler(async ({ input }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				return yield* db
					.update(dbSchema.organization)
					.set(input)
					.where(eq(dbSchema.organization.id, input.id))
					.returning({ ...getColumns(dbSchema.organization) })
					.pipe(Effect.map(([query]) => ({ data: query })));
			}),
		),
	);

export const deleteOrganizations = authed.organization.delete
	.use(
		checkManyPermissionMiddleware,
		(input) =>
			({
				entityIds: input.refs.map((ref) => ref.id),
				action: "delete",
				entityType: "organization",
			}) satisfies CheckManyPermissionInput,
	)
	.handler(async ({ context }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				yield* db
					.delete(dbSchema.organization)
					.where(inArray(dbSchema.organization.id, context.allowedIds));

				return { success: true, message: "Organizations deleted successfully" };
			}),
		),
	);
