import { DB, dbSchema } from "@orcai/db";
import { type AnyColumn, desc, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";
import type { LibraryAccess } from "@/lib/library/library-access";

/**
 * When a row last changed, falling back to creation time so a row that has
 * never been edited still sorts by age.
 */
const changedAt = (table: { updatedAt: AnyColumn; createdAt: AnyColumn }) =>
	sql<Date>`coalesce(${table.updatedAt}, ${table.createdAt})`;

/** Postgres returns the coalesced timestamp as text, so normalise before comparing. */
const toTime = (value: Date | string) => new Date(value).getTime();

/** The most recently changed bots, blocks and assets of the library the reader may read, newest first. */
export const recentResources = (access: LibraryAccess, limit: number) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { bot, block, asset } = dbSchema;

		const [bots, blocks, assets] = yield* Effect.all(
			[
				access.readable("bot").pipe(
					Effect.flatMap((readable) =>
						db
							.select({
								resourceId: bot.id,
								name: bot.name,
								status: bot.status,
								changedAt: changedAt(bot),
							})
							.from(bot)
							.where(readable)
							.orderBy(desc(changedAt(bot)))
							.limit(limit),
					),
				),
				access.readable("block").pipe(
					Effect.flatMap((readable) =>
						db
							.select({
								resourceId: block.id,
								name: block.name,
								blockType: block.type,
								status: block.status,
								changedAt: changedAt(block),
							})
							.from(block)
							.where(readable)
							.orderBy(desc(changedAt(block)))
							.limit(limit),
					),
				),
				access.readable("asset").pipe(
					Effect.flatMap((readable) =>
						db
							.select({
								resourceId: asset.id,
								name: asset.title,
								processingStatus: asset.processingStatus,
								changedAt: changedAt(asset),
							})
							.from(asset)
							.where(readable)
							.orderBy(desc(changedAt(asset)))
							.limit(limit),
					),
				),
			],
			{
				concurrency: "unbounded",
			},
		);

		return [
			...bots.map((bot) => ({
				resourceType: "bot" as const,
				...bot,
			})),
			...blocks.map((block) => ({
				resourceType: "block" as const,
				...block,
			})),
			...assets.map((asset) => ({
				resourceType: "asset" as const,
				...asset,
			})),
		]
			.sort((left, right) => toTime(right.changedAt) - toTime(left.changedAt))
			.slice(0, limit);
	});
