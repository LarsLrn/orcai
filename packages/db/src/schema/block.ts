import type { AssetId, BlockId, ChatId, UserId } from "@orcai/core";
import type { Block, BlockType, PublicationStatus } from "@orcai/schema";
import { sql } from "drizzle-orm";
import {
	type AnyPgColumn,
	bigint,
	index,
	integer,
	json,
	pgSequence,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { asset, pipelineFailureEnum, pipelineStatusEnum } from "./asset";
import { user } from "./auth";
import { chat } from "./chat";

export const block = pgTable("block", {
	id: uuid("id").$type<BlockId>().primaryKey().defaultRandom(),
	type: text("type").$type<BlockType>().notNull(),
	name: text("name").notNull(),
	description: varchar("description", {
		length: 500,
	}),
	contentJson: json("content_json").$type<Block["contentJson"]>(),
	config: json("config").$type<Block["config"]>().notNull(),
	status: text("status").$type<PublicationStatus>().notNull().default("ready"),
	userId: uuid("user_id")
		.$type<UserId>()
		.notNull()
		.references(() => user.id),
	forkedFromId: uuid("forked_from_id")
		.$type<BlockId>()
		.references((): AnyPgColumn => block.id, {
			onDelete: "set null",
		}),
	version: integer("version").notNull().default(1),
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
});

export const chatBlock = pgTable(
	"chat_block",
	{
		blockId: uuid("block_id")
			.$type<BlockId>()
			.notNull()
			.references(() => block.id, {
				onDelete: "cascade",
			}),
		chatId: uuid("chat_id")
			.$type<ChatId>()
			.notNull()
			.references(() => chat.id, {
				onDelete: "cascade",
			}),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [
		primaryKey({
			columns: [
				table.blockId,
				table.chatId,
			],
		}),
		index("chat_block_chat_idx").on(table.chatId, table.blockId),
	],
);

export const indexAttemptSequence = pgSequence("block_asset_index_attempt_seq");

export const blockAsset = pgTable(
	"block_asset",
	{
		blockId: uuid("block_id")
			.$type<BlockId>()
			.notNull()
			.references(() => block.id, {
				onDelete: "cascade",
			}),
		assetId: uuid("asset_id")
			.$type<AssetId>()
			.notNull()
			.references(() => asset.id, {
				onDelete: "cascade",
			}),
		indexStatus: pipelineStatusEnum("index_status")
			.notNull()
			.default("pending"),
		indexFailure: pipelineFailureEnum("index_failure"),
		/** Identifies the current indexing failure; a new failure gets a new id. */
		indexFailureId: uuid("index_failure_id"),
		/** Who asked for the current indexing; null when it was automatic. */
		indexActorId: uuid("index_actor_id")
			.$type<UserId>()
			.references(() => user.id, {
				onDelete: "set null",
			}),
		/**
		 * The link's current indexing attempt, new on every admission and on a
		 * relink; a delivery for another one changes nothing.
		 */
		indexAttempt: bigint("index_attempt", {
			mode: "number",
		})
			.notNull()
			.default(sql`nextval('block_asset_index_attempt_seq')`),
		/** The last attempt that completed: the only one whose points retrieval serves. */
		indexedAttempt: bigint("indexed_attempt", {
			mode: "number",
		}),
		/**
		 * The embedding generation the current attempt indexes into; null when
		 * it was admitted before embeddings were set up.
		 */
		embeddingGeneration: bigint("embedding_generation", {
			mode: "number",
		}),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [
		primaryKey({
			columns: [
				table.blockId,
				table.assetId,
			],
		}),
		index("block_asset_asset_idx").on(table.assetId, table.blockId),
		index("block_asset_index_failure_idx")
			.on(table.indexFailureId)
			.where(sql`${table.indexFailureId} is not null`),
		index("block_asset_index_failed_actor_idx")
			.on(table.indexActorId)
			.where(sql`${table.indexStatus} = 'failed'`),
		index("block_asset_index_unfinished_idx")
			.on(table.embeddingGeneration, table.assetId, table.blockId)
			.where(sql`${table.indexStatus} in ('pending', 'active')`),
	],
);
