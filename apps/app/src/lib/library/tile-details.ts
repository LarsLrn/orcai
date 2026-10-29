import type { BotId, OrganizationId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { BotListItem, SourceOrganization } from "@orcai/schema";
import { and, eq, inArray, isNull, not, type SQL, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
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

/**
 * For each resource the organisation added from the catalogue, the
 * organisation it comes from, as a lookup by id; null for the rest.
 */
export const installedFrom = (
	resourceType: "bot" | "block",
	ids: readonly string[],
	organizationId: OrganizationId | undefined,
) =>
	Effect.gen(function* () {
		const sources = new Map<string, SourceOrganization>();
		const lookup = (id: string) => sources.get(id) ?? null;
		if (ids.length === 0 || !organizationId) return lookup;
		const home = dbSchema.resourceScope;
		const install = alias(dbSchema.resourceScope, "install");
		const rows = yield* (yield* DB)
			.select({
				resourceId: home.resourceId,
				id: dbSchema.organization.id,
				name: dbSchema.organization.name,
				logo: dbSchema.organization.logo,
			})
			.from(install)
			.innerJoin(
				home,
				and(
					eq(home.resourceType, install.resourceType),
					eq(home.resourceId, install.resourceId),
					eq(home.isPrimary, true),
					isNull(home.endedAt),
				),
			)
			.innerJoin(
				dbSchema.organization,
				eq(dbSchema.organization.id, home.organizationId),
			)
			.where(
				and(
					eq(install.resourceType, resourceType),
					inArray(install.resourceId, [
						...ids,
					]),
					eq(install.organizationId, organizationId),
					not(install.isPrimary),
					isNull(install.endedAt),
				),
			);
		for (const { resourceId, ...source } of rows)
			sources.set(resourceId, source);
		return lookup;
	});
