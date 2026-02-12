import * as Effect from "effect/Effect";
import { DB } from "@/lib/effect/services/drizzle";
import { runOrpcEffect } from "@/lib/effect/utils/orpc-helpers";
import { authed } from "@/lib/orpc/implementation/authed";

export const listProviders = authed.provider.list.handler(async () =>
	runOrpcEffect(
		Effect.gen(function* () {
			const db = yield* DB;

			return yield* db.query.provider
				.findMany()
				.pipe(Effect.map((providers) => ({ data: providers })));
		}),
	),
);

export const findProvider = authed.provider.find
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

				return yield* db.query.provider
					.findFirst({
						where: {
							slug: input.slug,
						},
					})
					.pipe(
						Effect.flatMap((provider) =>
							Effect.fromNullable(provider).pipe(
								Effect.orElse(() =>
									Effect.fail(
										errors.NOT_FOUND({ message: "Provider not found" }),
									),
								),
							),
						),
						Effect.map((provider) => ({ data: provider })),
					);
			}),
		),
	);
