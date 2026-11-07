import type { AssetId, BlockId } from "@orcai/core";
import {
	index,
	integer,
	jsonb,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

/** What deleted resources left outside Postgres: stored files and the search points of their links. */
export type DeletedData = {
	readonly indexedLinks: readonly {
		readonly blockId: BlockId;
		readonly assetId: AssetId;
	}[];
	readonly files: readonly {
		readonly id: AssetId;
		readonly bucket: string;
		readonly prefix: string;
		readonly fileType: string;
	}[];
};

/** A committed deletion's external data, kept until all of it is removed. */
export const deletionCleanup = pgTable(
	"deletion_cleanup",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		data: jsonb("data").$type<DeletedData>().notNull(),
		attempts: integer("attempts").notNull().default(0),
		nextAttemptAt: timestamp("next_attempt_at").notNull(),
		lastError: text("last_error"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [
		index("deletion_cleanup_due_idx").on(table.nextAttemptAt),
	],
);

/** A deleted asset's id, kept while an upload could still create an asset under it again. */
export const deletedAsset = pgTable(
	"deleted_asset",
	{
		id: uuid("id").$type<AssetId>().primaryKey(),
		deletedAt: timestamp("deleted_at").notNull().defaultNow(),
	},
	(table) => [
		index("deleted_asset_deleted_at_idx").on(table.deletedAt),
	],
);
