import type { BotId, OrganizationId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { BotListItem } from "@orcai/schema";
import { and, eq, inArray, type SQL, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";

/*
 * What list tiles show beyond a resource's own row, loaded for a whole page
 * at once: never per tile.
 */

/** Which rows a tile loader selects, in which order, and optionally one page of them. */
export type TileQuery = {
	where: SQL | undefined;
	orderBy?: SQL[];
	page?: {
		limit: number;
		offset: number;
	};
};

type BotDetails = Pick<BotListItem, "contents" | "modelHint">;

/**
 * Each bot's composition and the model its setup in `organizationId` asks
 * for, as a lookup by bot id.
 */
export const botDetails = (
	botIds: readonly BotId[],
	organizationId: OrganizationId | undefined,
) =>
	Effect.gen(function* () {
		const contentsById = new Map<BotId, BotDetails["contents"]>();
		const hintById = new Map<BotId, BotDetails["modelHint"]>();
		const lookup = (botId: BotId): BotDetails => ({
			contents: contentsById.get(botId) ?? {
				behaviour: false,
				repositories: 0,
			},
			modelHint: hintById.get(botId) ?? null,
		});
		if (botIds.length === 0) return lookup;
		const db = yield* DB;
		const ids = [
			...botIds,
		];

		const [contents, hints] = yield* Effect.all(
			[
				db
					.select({
						botId: dbSchema.botBlock.botId,
						behaviour: sql<boolean>`bool_or(${dbSchema.block.type} = 'template')`,
						repositories: sql<number>`(count(*) filter (where ${dbSchema.block.type} = 'database'))::int`,
					})
					.from(dbSchema.botBlock)
					.innerJoin(
						dbSchema.block,
						eq(dbSchema.block.id, dbSchema.botBlock.blockId),
					)
					.where(inArray(dbSchema.botBlock.botId, ids))
					.groupBy(dbSchema.botBlock.botId),
				organizationId
					? db
							.select({
								botId: dbSchema.botSetup.botId,
								strength: dbSchema.botSetup.strength,
								modelName: dbSchema.model.name,
							})
							.from(dbSchema.botSetup)
							.innerJoin(
								dbSchema.model,
								eq(dbSchema.model.id, dbSchema.botSetup.modelId),
							)
							.where(
								and(
									inArray(dbSchema.botSetup.botId, ids),
									eq(dbSchema.botSetup.organizationId, organizationId),
								),
							)
					: Effect.succeed([]),
			],
			{
				concurrency: "unbounded",
			},
		);

		for (const { botId, ...composition } of contents) {
			contentsById.set(botId, composition);
		}
		for (const { botId, ...hint } of hints) {
			hintById.set(botId, hint);
		}
		return lookup;
	});
