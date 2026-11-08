import type { AssetId, BlockId, BotId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	type BotReadinessBlock,
	type BotReadinessIssue,
	botReadinessIssues,
} from "@orcai/schema";
import { asc, count, eq, inArray } from "drizzle-orm";
import * as Effect from "effect/Effect";
import * as AppErrors from "@/lib/effect/utils/errors";

/** The blocks each bot links, with what its readiness depends on. */
const readinessBlocks = (botIds: readonly BotId[]) =>
	Effect.gen(function* () {
		const blocksByBot = new Map<BotId, BotReadinessBlock[]>(
			botIds.map((botId) => [
				botId,
				[],
			]),
		);
		if (botIds.length === 0) return blocksByBot;
		const rows = yield* (yield* DB)
			.select({
				botId: dbSchema.botBlock.botId,
				type: dbSchema.block.type,
				name: dbSchema.block.name,
				status: dbSchema.block.status,
				assetCount: count(dbSchema.blockAsset.assetId),
			})
			.from(dbSchema.botBlock)
			.innerJoin(
				dbSchema.block,
				eq(dbSchema.block.id, dbSchema.botBlock.blockId),
			)
			.leftJoin(
				dbSchema.blockAsset,
				eq(dbSchema.blockAsset.blockId, dbSchema.block.id),
			)
			.where(
				inArray(dbSchema.botBlock.botId, [
					...botIds,
				]),
			)
			.groupBy(dbSchema.botBlock.botId, dbSchema.block.id)
			.orderBy(asc(dbSchema.block.name), asc(dbSchema.block.id));
		for (const { botId, ...block } of rows) blocksByBot.get(botId)?.push(block);
		return blocksByBot;
	});

/** Every reason the bot cannot be ready. */
export const botReadiness = (botId: BotId) =>
	readinessBlocks([
		botId,
	]).pipe(
		Effect.map((blocksByBot) =>
			botReadinessIssues(blocksByBot.get(botId) ?? []),
		),
	);

const issueMessage = (issue: BotReadinessIssue) => {
	switch (issue.reason) {
		case "BOT_BEHAVIOUR_BLOCK_REQUIRED":
			return "The bot needs a published behaviour.";
		case "BOT_BEHAVIOUR_BLOCK_NOT_READY":
			return "Publish the bot's behaviour before publishing this bot.";
		case "BOT_REPOSITORY_NOT_READY":
			return `Set "${issue.params.blockName}" to "ready" before publishing this bot.`;
		case "BOT_REPOSITORY_EMPTY":
			return `Attach at least one asset to "${issue.params.blockName}" before publishing.`;
	}
};

/** Locks the bots' rows, so readiness is read where no block write can interleave. */
const lockBots = (botIds: readonly BotId[]) =>
	Effect.gen(function* () {
		if (botIds.length === 0) return [];
		return yield* (yield* DB)
			.select({
				id: dbSchema.bot.id,
				status: dbSchema.bot.status,
			})
			.from(dbSchema.bot)
			.where(
				inArray(dbSchema.bot.id, [
					...botIds,
				]),
			)
			.orderBy(asc(dbSchema.bot.id))
			.for("update");
	});

/** Fails with the first reason the bot cannot be ready. Call it in the transaction that makes it ready. */
export const requireReadyBot = (botId: BotId) =>
	Effect.gen(function* () {
		yield* lockBots([
			botId,
		]);
		const [issue] = yield* botReadiness(botId);
		if (issue)
			return yield* new AppErrors.BadRequestError({
				...issue,
				message: issueMessage(issue),
			});
	});

/** Moves the ready bots among `botIds` that no longer meet the readiness rule to draft. */
export const draftUnreadyBots = (botIds: readonly BotId[]) =>
	Effect.gen(function* () {
		const ready = (yield* lockBots(botIds))
			.filter((bot) => bot.status === "ready")
			.map((bot) => bot.id);
		const blocksByBot = yield* readinessBlocks(ready);
		const unready = ready.filter(
			(botId) => botReadinessIssues(blocksByBot.get(botId) ?? []).length > 0,
		);
		if (unready.length === 0) return;
		yield* (yield* DB)
			.update(dbSchema.bot)
			.set({
				status: "draft",
				updatedAt: new Date(),
			})
			.where(inArray(dbSchema.bot.id, unready));
	});

/** The bots linking the blocks, or the repositories holding the assets. */
const botsLinking = (
	linked:
		| {
				blockIds: readonly BlockId[];
		  }
		| {
				assetIds: readonly AssetId[];
		  },
) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const blockIds =
			"blockIds" in linked
				? [
						...linked.blockIds,
					]
				: db
						.select({
							id: dbSchema.blockAsset.blockId,
						})
						.from(dbSchema.blockAsset)
						.where(
							inArray(dbSchema.blockAsset.assetId, [
								...linked.assetIds,
							]),
						);
		const rows = yield* db
			.selectDistinct({
				id: dbSchema.botBlock.botId,
			})
			.from(dbSchema.botBlock)
			.where(inArray(dbSchema.botBlock.blockId, blockIds));
		return rows.map((row) => row.id);
	});

/**
 * Runs `write` on the blocks or assets, then moves the ready bots it leaves
 * short of the readiness rule to draft. Bots are found before the write, since
 * a deletion takes their links with it, and locked after it, so a publish
 * either commits first and is drafted or reads the write.
 */
export const draftingUnreadyBots = <A, E, R>(
	linked: Parameters<typeof botsLinking>[0],
	write: Effect.Effect<A, E, R>,
) =>
	Effect.gen(function* () {
		const botIds = yield* botsLinking(linked);
		const result = yield* write;
		yield* draftUnreadyBots(botIds);
		return result;
	});
