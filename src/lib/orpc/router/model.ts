import { count, eq, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { dbSchema } from "@/db/schema";
import { DB } from "@/lib/effect/services/drizzle";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";

export const listModels = authed.model.list.handler(async ({ input }) =>
	runOrpcEffect(
		Effect.gen(function* () {
			const db = yield* DB;

			const [data, [rowCount]] = yield* Effect.all(
				[
					db.query.model.findMany({
						limit: input.pageSize,
						offset: input.pageIndex * input.pageSize,
					}),
					db.select({ count: count() }).from(dbSchema.model),
				],
				{ concurrency: "unbounded" },
			);

			return { data, rowCount: rowCount.count };
		}),
	),
);

export const findModel = authed.model.find
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

				const model = yield* db.query.model
					.findFirst({
						where: {
							id: input.id,
						},
					})
					.pipe(
						Effect.flatMap((model) =>
							Effect.fromNullable(model).pipe(
								Effect.orElse(() =>
									Effect.fail(errors.NOT_FOUND({ message: "Model not found" })),
								),
							),
						),
					);

				return { data: model };
			}),
		),
	);

export const createModel = authed.model.create.handler(async ({ input }) =>
	runOrpcEffect(
		Effect.gen(function* () {
			const db = yield* DB;

			const [model] = yield* db
				.insert(dbSchema.model)
				.values(input)
				.returning();

			return { data: model };
		}),
	),
);

export const updateModel = authed.model.update.handler(
	async ({ input, errors }) =>
		runOrpcEffect(
			Effect.gen(function* () {
				const db = yield* DB;

				const [model] = yield* db
					.update(dbSchema.model)
					.set(input)
					.where(eq(dbSchema.model.id, input.id))
					.returning();

				if (!model) {
					return yield* Effect.fail(
						errors.NOT_FOUND({ message: "Model not found" }),
					);
				}

				return { data: model };
			}),
		),
);

export const deleteModel = authed.model.delete.handler(async ({ input }) =>
	runOrpcEffect(
		Effect.gen(function* () {
			const db = yield* DB;

			yield* db.delete(dbSchema.model).where(
				inArray(
					dbSchema.model.id,
					input.refs.map((ref) => ref.id),
				),
			);

			return { success: true, message: "Models deleted successfully" };
		}),
	),
);
