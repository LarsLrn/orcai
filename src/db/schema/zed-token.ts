import { pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const zedTokenTable = pgTable("zed_token", {
	resourceId: uuid("resource_id").primaryKey().notNull(),
	resourceType: varchar("resource_type", { length: 1024 }).notNull(),
	zedToken: varchar("zed_token", { length: 1024 }).notNull(),
	createdAt: timestamp("created_at").notNull().defaultNow(),
});
