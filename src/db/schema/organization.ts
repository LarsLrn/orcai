import type { InferSelectModel } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const organization = pgTable("organization", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	slug: text("slug").unique().notNull(),
	logo: text("logo"),
	createdAt: timestamp("created_at").notNull(),
	metadata: text("metadata"),
});

export type Organization = InferSelectModel<typeof organization>;

export const member = pgTable("member", {
	id: uuid("id").primaryKey().defaultRandom(),
	organizationId: uuid("organization_id")
		.notNull()
		.references(() => organization.id),
	userId: uuid("user_id")
		.notNull()
		.references(() => user.id),
	role: text("role").notNull(),
	createdAt: timestamp("created_at").defaultNow(),
});

export type Member = InferSelectModel<typeof member>;

export const invitation = pgTable("invitation", {
	id: uuid("id").primaryKey().defaultRandom(),
	organizationId: uuid("organization_id")
		.notNull()
		.references(() => organization.id),
	email: text("email").notNull(),
	role: text("role"),
	// TODO: Add course ID
	status: text("status").notNull(),
	expiresAt: timestamp("expires_at").notNull(),
	inviterId: uuid("inviter_id")
		.notNull()
		.references(() => user.id),
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
});

export type Invitation = InferSelectModel<typeof invitation>;
