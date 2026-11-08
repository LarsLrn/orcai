import type { DataExportId, UserId } from "@orcai/core";
import { DATA_EXPORT_STATUSES } from "@orcai/schema";
import { sql } from "drizzle-orm";
import {
	bigint,
	index,
	pgEnum,
	pgTable,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";

export const dataExportStatusEnum = pgEnum(
	"data_export_status",
	DATA_EXPORT_STATUSES,
);

export const dataExport = pgTable(
	"data_export",
	{
		id: uuid("id").$type<DataExportId>().primaryKey().defaultRandom(),
		userId: uuid("user_id")
			.$type<UserId>()
			.notNull()
			.references(() => user.id, {
				onDelete: "cascade",
			}),
		status: dataExportStatusEnum("status").notNull().default("pending"),
		size: bigint("size", {
			mode: "number",
		}),
		completedAt: timestamp("completed_at"),
		expiresAt: timestamp("expires_at"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => [
		// One export in flight per user.
		uniqueIndex("data_export_user_in_flight_unique")
			.on(table.userId)
			.where(sql`${table.status} in ('pending', 'processing')`),
		index("data_export_user_created_idx").on(table.userId, table.createdAt),
	],
);
