import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { course } from "./course";

export const courseInvitation = pgTable("course_invitation", {
	id: uuid("id").primaryKey().defaultRandom(),
	email: text("email").notNull(),
	courseId: uuid("course_id")
		.notNull()
		.references(() => course.id, { onDelete: "cascade" }),
	role: text("role").notNull(),
	status: text("status").notNull(),
	expiresAt: timestamp("expires_at").notNull(),
	inviterId: uuid("inviter_id")
		.notNull()
		.references(() => user.id),
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
});
