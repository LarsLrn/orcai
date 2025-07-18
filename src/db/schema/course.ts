import { type InferSelectModel, relations } from "drizzle-orm";
import {
	json,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { organization } from "./organization";

export interface CourseConfigType {
	systemPrompt?: string;
	maxReferences?: number;
	model?: string;
}

export const course = pgTable("course", {
	id: uuid("id").primaryKey().defaultRandom(),
	title: text("title").notNull(),
	organizationId: uuid("organization_id")
		.notNull()
		.references(() => organization.id, { onDelete: "cascade" }),
	contentJson: json("content_json").notNull().default({}),
	contentHtml: text("content_html").notNull(),
	description: varchar("description", { length: 500 }).notNull(),
	config: json("config").notNull().$type<CourseConfigType>().default({}),
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
});

export type Course = InferSelectModel<typeof course>;

export const courseMember = pgTable(
	"course_member",
	{
		courseId: uuid("course_id")
			.notNull()
			.references(() => course.id, { onDelete: "cascade" }),
		userId: uuid("user_id")
			.notNull()
			.references(() => user.id),
		role: text("role").notNull(),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [
		primaryKey({
			columns: [table.courseId, table.userId],
		}),
	],
);

export type CourseMember = InferSelectModel<typeof course>;

export const coursesRelations = relations(course, ({ one }) => ({
	organizationId: one(organization, {
		fields: [course.organizationId],
		references: [organization.id],
	}),
}));
