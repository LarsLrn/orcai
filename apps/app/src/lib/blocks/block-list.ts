import { DB, dbSchema } from "@orcai/db";
import type { Block, ListBlocksInput, ResourceOwner } from "@orcai/schema";
import {
	and,
	asc,
	count,
	desc,
	eq,
	getColumns,
	ilike,
	inArray,
	sql,
} from "drizzle-orm";
import * as Effect from "effect/Effect";
import { emptyCapabilities } from "@/lib/authz/capabilities";
import { readableIds } from "@/lib/authz/content-access";
import { getManyEntityCapabilities } from "@/lib/authz/entity-capabilities";
import { repositoryTotals } from "@/lib/blocks/readiness";
import type { LibraryAccess, Reader } from "@/lib/library/library-access";
import { installedFrom, type TileQuery } from "@/lib/library/tile-details";
import { ownerColumns } from "@/lib/orpc/router/helpers/resource-owner";
import { literalSearch } from "@/lib/utils/literal-search";

const blockOrder = {
	newest: [
		desc(dbSchema.block.createdAt),
		desc(dbSchema.block.id),
	],
	name: [
		asc(dbSchema.block.name),
		asc(dbSchema.block.id),
	],
} satisfies Record<ListBlocksInput["sort"], unknown[]>;

/** The blocks `query` selects, with what their tiles show. */
export const blockTiles = (reader: Reader, query: TileQuery) =>
	Effect.gen(function* () {
		const select = (yield* DB)
			.select({
				...getColumns(dbSchema.block),
				owner: ownerColumns,
			})
			.from(dbSchema.block)
			.innerJoin(dbSchema.user, eq(dbSchema.user.id, dbSchema.block.userId))
			.where(query.where)
			.orderBy(...(query.orderBy ?? []))
			.$dynamic();
		const blocks = (yield* query.page
			? select.limit(query.page.limit).offset(query.page.offset)
			: select) as (Block & {
			owner: ResourceOwner;
		})[];

		const ids = blocks.map((block) => block.id);
		const [capabilities, totals, sources] = yield* Effect.all(
			[
				getManyEntityCapabilities({
					entityType: "block",
					entityIds: ids,
					userId: reader.userId,
					organizationId: reader.organizationId,
					zedToken: reader.zedToken,
				}),
				repositoryTotals(
					blocks
						.filter((block) => block.type === "database")
						.map((block) => block.id),
				),
				installedFrom("block", ids, reader.organizationId),
			],
			{
				concurrency: "unbounded",
			},
		);

		return blocks.map((block) => ({
			...block,
			capabilities: capabilities.get(block.id) ?? emptyCapabilities("block"),
			assets: block.type === "database" ? totals(block.id) : null,
			installedFrom: sources(block.id),
		}));
	});

/** One page of a bot's blocks, or of the blocks in the active organisation's library. */
export const listBlockTiles = (params: {
	input: ListBlocksInput;
	reader: Reader;
	access: LibraryAccess;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { input, reader } = params;
		const botId = input.filters?.botId;
		const status = input.filters?.status ?? "ready";

		// A bot's blocks are its contents, readable with it; the rest is the library.
		const visible = botId
			? and(
					(yield* readableIds(
						"bot",
						[
							botId,
						],
						reader,
					)).has(botId)
						? inArray(
								dbSchema.block.id,
								db
									.select({
										blockId: dbSchema.botBlock.blockId,
									})
									.from(dbSchema.botBlock)
									.where(eq(dbSchema.botBlock.botId, botId)),
							)
						: sql`false`,
					status === "all" ? undefined : eq(dbSchema.block.status, status),
				)
			: yield* params.access.condition("block", {
					scope: input.filters?.scope,
					status,
					source: input.filters?.source,
				});
		const where = and(
			visible,
			input.filters?.type
				? eq(dbSchema.block.type, input.filters.type)
				: undefined,
			input.filters?.search
				? ilike(dbSchema.block.name, literalSearch(input.filters.search))
				: undefined,
		);

		const [data, [counted]] = yield* Effect.all(
			[
				blockTiles(reader, {
					where,
					orderBy: blockOrder[input.sort],
					page: {
						limit: input.pageSize,
						offset: input.pageIndex * input.pageSize,
					},
				}),
				db
					.select({
						count: count(),
					})
					.from(dbSchema.block)
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
