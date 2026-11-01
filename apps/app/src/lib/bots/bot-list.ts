import { DB, dbSchema } from "@orcai/db";
import type { Bot, ListBotsInput } from "@orcai/schema";
import {
	and,
	asc,
	count,
	desc,
	eq,
	getColumns,
	ilike,
	isNotNull,
	isNull,
} from "drizzle-orm";
import * as Effect from "effect/Effect";
import { emptyCapabilities } from "@/lib/authz/capabilities";
import { getManyEntityCapabilities } from "@/lib/authz/entity-capabilities";
import { favouriteOf, isFavourite } from "@/lib/bots/bot-favourites";
import type { LibraryAccess, Reader } from "@/lib/library/library-access";
import {
	botDetails,
	homeOrganizations,
	type TileQuery,
} from "@/lib/library/tile-details";
import { ownerColumns } from "@/lib/orpc/router/helpers/resource-owner";
import { literalSearch } from "@/lib/utils/literal-search";

const orderBy = {
	name: [
		asc(dbSchema.bot.name),
		asc(dbSchema.bot.id),
	],
	favouritesFirst: [
		desc(isFavourite),
		asc(dbSchema.bot.name),
		asc(dbSchema.bot.id),
	],
	newest: [
		desc(dbSchema.bot.createdAt),
		desc(dbSchema.bot.id),
	],
} satisfies Record<ListBotsInput["sort"], unknown[]>;

/** The bots `query` selects, with what their tiles show. */
export const botTiles = (reader: Reader, query: TileQuery) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const select = db
			.select({
				...getColumns(dbSchema.bot),
				isFavourite,
				owner: ownerColumns,
			})
			.from(dbSchema.bot)
			.innerJoin(dbSchema.user, eq(dbSchema.user.id, dbSchema.bot.userId))
			.leftJoin(dbSchema.botFavourite, favouriteOf(reader.userId))
			.where(query.where)
			.orderBy(...(query.orderBy ?? []))
			.$dynamic();
		const rows = yield* query.page
			? select.limit(query.page.limit).offset(query.page.offset)
			: select;

		const ids = rows.map((bot) => bot.id);
		const [capabilities, details, homes] = yield* Effect.all(
			[
				getManyEntityCapabilities({
					entityType: "bot",
					entityIds: ids,
					userId: reader.userId,
					organizationId: reader.organizationId,
					zedToken: reader.zedToken,
				}),
				botDetails(ids, reader.organizationId),
				homeOrganizations("bot", ids, reader.organizationId),
			],
			{
				concurrency: "unbounded",
			},
		);

		return rows.map((bot) => ({
			...bot,
			contentJson: bot.contentJson as Bot["contentJson"],
			capabilities: capabilities.get(bot.id) ?? emptyCapabilities("bot"),
			...details(bot.id),
			homeOrganization: homes(bot.id),
		}));
	});

/** One page of the bots in the active organisation's library, with their tile details. */
export const listBotTiles = (params: {
	input: ListBotsInput;
	reader: Reader;
	access: LibraryAccess;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { input, reader } = params;

		const where = and(
			yield* params.access.condition("bot", {
				scope: input.filters?.scope,
				status: input.filters?.status,
				origin: input.filters?.origin,
			}),
			input.filters?.usable ? yield* params.access.usable("bot") : undefined,
			input.search
				? ilike(dbSchema.bot.name, literalSearch(input.search))
				: undefined,
			input.filters?.favourite === undefined
				? undefined
				: input.filters.favourite
					? isNotNull(dbSchema.botFavourite.botId)
					: isNull(dbSchema.botFavourite.botId),
		);

		const [data, [counted]] = yield* Effect.all(
			[
				botTiles(reader, {
					where,
					orderBy: orderBy[input.sort],
					page: {
						limit: input.pageSize,
						offset: input.pageIndex * input.pageSize,
					},
				}),
				db
					.select({
						count: count(),
					})
					.from(dbSchema.bot)
					.leftJoin(dbSchema.botFavourite, favouriteOf(reader.userId))
					.where(where),
			],
			{
				concurrency: "unbounded",
			},
		);

		return {
			data,
			rowCount: counted.count,
		};
	});
