import {
	json,
	pgTable,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import type { CourseConfigType } from "@/lib/orpc/schemas/fragments/course-config";
import { organization } from "./organization";

export const course = pgTable("course", {
	id: uuid("id").primaryKey().defaultRandom(),
	title: text("title").notNull(),
	organizationId: uuid("organization_id")
		.notNull()
		.references(() => organization.id, {
			onDelete: "cascade",
		}),
	description: varchar("description", {
		length: 500,
	}).notNull(),
	contentJson: json("content_json").notNull().default({}),
	contentHtml: text("content_html").notNull(),
	config: json("config").notNull().$type<CourseConfigType>(),
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
});
