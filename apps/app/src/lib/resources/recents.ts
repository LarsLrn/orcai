import type { UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { BlockType } from "@orcai/schema";
import { lookupEntitiesByPermission } from "@orcai/spice-db";
import { type AnyColumn, desc, inArray, sql } from "drizzle-orm";
import * as Effect from "effect/Effect";

/**
 * When a row last changed, falling back to creation time so a row that has
 * never been edited still sorts by age.
 */
const changedAt = (table: { updatedAt: AnyColumn; createdAt: AnyColumn }) =>
	sql<Date>`coalesce(${table.updatedAt}, ${table.createdAt})`;

/** Postgres returns the coalesced timestamp as text, so normalise before comparing. */
const toTime = (value: Date | string) => new Date(value).getTime();

/** The user's most recently changed readable bots, blocks and assets, newest first. */
export const recentResources = (params: {
	userId: UserId;
	limit: number;
	zedToken: string | undefined;
}) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { userId, zedToken } = params;

		const readableIds = <TEntity extends "asset" | "block" | "bot">(
			entityType: TEntity,
		) =>
			lookupEntitiesByPermission({
				entityType,
				permission: "read",
				userId,
				zedToken,
			});

		const [bots, blocks, assets] = yield* Effect.all(
			[
				readableIds("bot").pipe(
					Effect.flatMap((ids) =>
						ids.length === 0
							? Effect.succeed([])
							: db
									.select({
										resourceId: dbSchema.bot.id,
										name: dbSchema.bot.name,
										status: dbSchema.bot.status,
										changedAt: changedAt(dbSchema.bot),
									})
									.from(dbSchema.bot)
									.where(inArray(dbSchema.bot.id, ids))
									.orderBy(desc(changedAt(dbSchema.bot)))
									.limit(params.limit),
					),
				),
				readableIds("block").pipe(
					Effect.flatMap((ids) =>
						ids.length === 0
							? Effect.succeed([])
							: db
									.select({
										resourceId: dbSchema.block.id,
										name: dbSchema.block.name,
										blockType: dbSchema.block.type,
										status: dbSchema.block.status,
										changedAt: changedAt(dbSchema.block),
									})
									.from(dbSchema.block)
									.where(inArray(dbSchema.block.id, ids))
									.orderBy(desc(changedAt(dbSchema.block)))
									.limit(params.limit),
					),
				),
				readableIds("asset").pipe(
					Effect.flatMap((ids) =>
						ids.length === 0
							? Effect.succeed([])
							: db
									.select({
										resourceId: dbSchema.asset.id,
										name: dbSchema.asset.title,
										processingStatus: dbSchema.asset.processingStatus,
										changedAt: changedAt(dbSchema.asset),
									})
									.from(dbSchema.asset)
									.where(inArray(dbSchema.asset.id, ids))
									.orderBy(desc(changedAt(dbSchema.asset)))
									.limit(params.limit),
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
				blockType: block.blockType as BlockType,
			})),
			...assets.map((asset) => ({
				resourceType: "asset" as const,
				...asset,
			})),
		]
			.sort((left, right) => toTime(right.changedAt) - toTime(left.changedAt))
			.slice(0, params.limit);
	});
