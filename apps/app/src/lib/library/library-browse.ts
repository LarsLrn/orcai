import type { AssetId, BlockId, BotId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type {
	LibraryCounts,
	LibraryEntry,
	LibraryKind,
	LibraryOverviewInput,
	LibraryScope,
	PublicationStatusFilter,
	SearchLibraryInput,
} from "@orcai/schema";
import {
	type AnyColumn,
	and,
	asc,
	count,
	desc,
	eq,
	ilike,
	inArray,
	type SQL,
	sql,
} from "drizzle-orm";
import * as Effect from "effect/Effect";
import { assetTiles, listAssetTiles } from "@/lib/assets/asset-list";
import { blockTiles, listBlockTiles } from "@/lib/blocks/block-list";
import { botTiles, listBotTiles } from "@/lib/bots/bot-list";
import {
	type LibraryAccess,
	libraryAccess,
	type Reader,
} from "@/lib/library/library-access";
import { literalSearch } from "@/lib/utils/literal-search";

/** How many tiles an overview shelf holds. */
const SHELF_SIZE = 12;

type EntryFilters = {
	scope: LibraryScope;
	status: PublicationStatusFilter;
	search?: string;
};

/**
 * Every library item the reader may list and the filters let through, of
 * every kind, as one subquery of kind, id, name and creation time. Assets
 * are those uploaded to the library; having no status, drafts leave them out.
 */
const entries = (access: LibraryAccess, filters: EntryFilters) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { scope, status } = filters;
		const matches = (column: AnyColumn) =>
			filters.search ? ilike(column, literalSearch(filters.search)) : undefined;
		const [bots, blocks, assets] = yield* Effect.all(
			[
				access.condition("bot", {
					scope,
					status,
				}),
				access.condition("block", {
					scope,
					status,
				}),
				access.condition("asset", {
					scope,
				}),
			],
			{
				concurrency: "unbounded",
			},
		);

		const fields = (
			kind: SQL<LibraryKind>,
			table: {
				id: AnyColumn;
				createdAt: AnyColumn;
			},
			name: AnyColumn,
		) => ({
			kind: kind.as("kind"),
			id: sql<string>`${table.id}`.as("id"),
			name: sql<string>`${name}`.as("name"),
			createdAt: sql<Date>`${table.createdAt}`.as("created_at"),
		});

		const union = db
			.select(fields(sql<LibraryKind>`'bot'`, dbSchema.bot, dbSchema.bot.name))
			.from(dbSchema.bot)
			.where(and(bots, matches(dbSchema.bot.name)))
			.unionAll(
				db
					.select(
						fields(
							sql<LibraryKind>`case when ${dbSchema.block.type} = 'template' then 'behaviour' else 'repository' end`,
							dbSchema.block,
							dbSchema.block.name,
						),
					)
					.from(dbSchema.block)
					.where(and(blocks, matches(dbSchema.block.name))),
			);
		return (
			status === "draft"
				? union
				: union.unionAll(
						db
							.select(
								fields(
									sql<LibraryKind>`'asset'`,
									dbSchema.asset,
									dbSchema.asset.title,
								),
							)
							.from(dbSchema.asset)
							.where(
								and(
									assets,
									eq(dbSchema.asset.origin, "library"),
									matches(dbSchema.asset.title),
								),
							),
					)
		).as("entries");
	});

/** How many items of each kind the reader may list in scope, matching `search`. */
export const libraryCounts = (
	access: LibraryAccess,
	filters: Omit<EntryFilters, "status">,
) =>
	Effect.gen(function* () {
		const listed = yield* entries(access, {
			...filters,
			status: "all",
		});
		const rows = yield* (yield* DB)
			.select({
				kind: listed.kind,
				count: count(),
			})
			.from(listed)
			.groupBy(listed.kind);
		const counts: LibraryCounts = {
			bot: 0,
			behaviour: 0,
			repository: 0,
			asset: 0,
		};
		for (const row of rows) counts[row.kind] = row.count;
		return counts;
	});

/** Tiles for `listed`, in its order; an item deleted meanwhile drops out. */
const hydrate = (
	reader: Reader,
	listed: readonly {
		kind: LibraryKind;
		id: string;
	}[],
) =>
	Effect.gen(function* () {
		const idsOf = (kinds: LibraryKind[]) =>
			listed.filter((entry) => kinds.includes(entry.kind)).map(({ id }) => id);
		const botIds = idsOf([
			"bot",
		]) as BotId[];
		const blockIds = idsOf([
			"behaviour",
			"repository",
		]) as BlockId[];
		const assetIds = idsOf([
			"asset",
		]) as AssetId[];
		const [bots, blocks, assets] = yield* Effect.all(
			[
				botIds.length > 0
					? botTiles(reader, {
							where: inArray(dbSchema.bot.id, botIds),
						})
					: Effect.succeed([]),
				blockIds.length > 0
					? blockTiles(reader, {
							where: inArray(dbSchema.block.id, blockIds),
						})
					: Effect.succeed([]),
				assetIds.length > 0
					? assetTiles(reader, {
							where: inArray(dbSchema.asset.id, assetIds),
						})
					: Effect.succeed([]),
			],
			{
				concurrency: "unbounded",
			},
		);

		const tiles = new Map<string, LibraryEntry>();
		for (const bot of bots)
			tiles.set(bot.id, {
				kind: "bot",
				bot,
			});
		for (const block of blocks)
			tiles.set(block.id, {
				kind: "block",
				block,
			});
		for (const asset of assets)
			tiles.set(asset.id, {
				kind: "asset",
				asset,
			});
		return listed.flatMap(({ id }) => tiles.get(id) ?? []);
	});

/** One page of every kind at once, ordered across kinds. */
export const searchLibrary = (
	input: SearchLibraryInput,
	reader: Reader,
	access: LibraryAccess,
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const listed = yield* entries(access, input);
		const orderBy =
			input.sort === "name"
				? [
						asc(listed.name),
						asc(listed.id),
					]
				: [
						desc(listed.createdAt),
						desc(listed.id),
					];

		const [page, [counted]] = yield* Effect.all(
			[
				db
					.select({
						kind: listed.kind,
						id: listed.id,
					})
					.from(listed)
					.orderBy(...orderBy)
					.limit(input.pageSize)
					.offset(input.pageIndex * input.pageSize),
				db
					.select({
						count: count(),
					})
					.from(listed),
			],
			{
				concurrency: "unbounded",
			},
		);

		return {
			data: yield* hydrate(reader, page),
			rowCount: counted.count,
		};
	});

/** The overview's shelves; one SpiceDB enumeration per kind and permission serves them all. */
export const libraryOverview = (input: LibraryOverviewInput, reader: Reader) =>
	Effect.gen(function* () {
		const access = yield* libraryAccess(reader);
		const { scope } = input;
		const shelf = {
			pageIndex: 0,
			pageSize: SHELF_SIZE,
			sort: "newest",
		} as const;
		const blocksOf = (type: "template" | "database") =>
			listBlockTiles({
				input: {
					...shelf,
					filters: {
						type,
						scope,
						status: "all",
					},
				},
				reader,
				access,
			});

		const [favourites, drafts, bot, behaviour, repository, asset] =
			yield* Effect.all(
				[
					listBotTiles({
						input: {
							...shelf,
							sort: "name",
							filters: {
								favourite: true,
								scope,
							},
						},
						reader,
						access,
					}),
					scope === "edit"
						? searchLibrary(
								{
									...shelf,
									scope,
									status: "draft",
								},
								reader,
								access,
							)
						: Effect.succeed({
								data: [],
							}),
					listBotTiles({
						input: {
							...shelf,
							filters: {
								scope,
								status: "all",
							},
						},
						reader,
						access,
					}),
					blocksOf("template"),
					blocksOf("database"),
					listAssetTiles({
						input: {
							...shelf,
							filters: {
								scope,
								origin: "library",
							},
						},
						reader,
						access,
					}),
				],
				{
					concurrency: "unbounded",
				},
			);

		return {
			favourites: favourites.data,
			drafts: drafts.data,
			bot,
			behaviour,
			repository,
			asset,
		};
	});
