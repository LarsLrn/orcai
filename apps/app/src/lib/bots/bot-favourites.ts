import type { BotId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { and, eq, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as AppErrors from "@/lib/effect/utils/errors";

/** Left-join condition for the user's favourite row; drafts never match. */
export const favouriteOf = (userId: UserId) =>
	and(
		eq(dbSchema.botFavourite.botId, dbSchema.bot.id),
		eq(dbSchema.botFavourite.userId, userId),
		eq(dbSchema.bot.status, "ready"),
	);

export const isFavourite = sql<boolean>`${dbSchema.botFavourite.botId} is not null`;

/** Idempotent; the caller checks read permission on the bot. */
export const setBotFavourite = (params: {
	botId: BotId;
	userId: UserId;
	favourite: boolean;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;

		const [bot] = yield* db
			.select({
				status: dbSchema.bot.status,
			})
			.from(dbSchema.bot)
			.where(eq(dbSchema.bot.id, params.botId));

		if (!bot) {
			return yield* new AppErrors.NotFoundError({
				reason: "BOT_NOT_FOUND",
				id: params.botId,
			});
		}

		if (bot.status !== "ready") {
			return yield* new AppErrors.BadRequestError({
				reason: "BOT_NOT_PUBLISHED",
				message: "Only published bots can be favourites.",
			});
		}

		if (params.favourite) {
			yield* db
				.insert(dbSchema.botFavourite)
				.values({
					botId: params.botId,
					userId: params.userId,
				})
				.onConflictDoNothing();
		} else {
			yield* db
				.delete(dbSchema.botFavourite)
				.where(
					and(
						eq(dbSchema.botFavourite.botId, params.botId),
						eq(dbSchema.botFavourite.userId, params.userId),
					),
				);
		}

		return {
			data: {
				id: params.botId,
				favourite: params.favourite,
			},
		};
	});
