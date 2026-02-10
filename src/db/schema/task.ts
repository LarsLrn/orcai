import { integer, json, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import type { TaskStatus } from "@/lib/orpc/schemas/task";

export const task = pgTable("task", {
	resourceId: text("resource_id").notNull(),
	resourceType: text("resource_type").notNull(),
	runId: text("run_id").primaryKey(),
	task: text("task").notNull(),
	payload: json("payload"),
	runCount: integer("run_count"),
	publicAccessToken: text("public_access_token").notNull(),
	status: text("status").notNull().$type<TaskStatus>(),
	startedAt: timestamp("started_at"),
	finishedAt: timestamp("finished_at"),
	createdAt: timestamp("created_at").notNull().defaultNow(),
	updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
