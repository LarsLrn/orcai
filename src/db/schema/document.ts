import type { InferSelectModel } from "drizzle-orm";
import {
	integer,
	json,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { course } from "./course";

export interface DocumentMetadataType {
	showReference: boolean;
	relevance: "high" | "medium" | "low";
	citation?: string;
	externalUrl?: string;
	pageRange?: string;
	author?: string;
	chapterTitle?: string;
	mergePages?: boolean;
}

export type DocumentStatus =
	| "pending"
	| "processing-document"
	| "generating-embedding"
	| "ready"
	| "failed";

export const document = pgTable("document", {
	id: uuid("id").primaryKey().defaultRandom(),
	bucket: text("bucket").notNull(),
	prefix: text("prefix").notNull(),
	title: text("title").notNull(),
	metadata: json("metadata")
		.notNull()
		.$type<DocumentMetadataType>()
		.default({ showReference: true, relevance: "medium" }),
	size: integer("size").notNull(),
	// TODO: Should probably be an enum
	fileType: text("file_type").notNull(),
	// TODO: Check what should be done if user deletes account
	courseId: uuid("course_id")
		.notNull()
		.references(() => course.id),
	uploadedBy: uuid("uploaded_by")
		.notNull()
		.references(() => user.id),
	status: text("status").notNull().default("pending"),
	updatedAt: timestamp("updated_at").defaultNow(),
	createdAt: timestamp("created_at").defaultNow(),
});

export type Document = InferSelectModel<typeof document>;
