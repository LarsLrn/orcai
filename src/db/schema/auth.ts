import type { InferSelectModel } from "drizzle-orm";
import {
	boolean,
	json,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";

export interface UserPreferencesType {
	tours?: {
		initialTour?: "completed" | "skipped";
		chatTour?: "completed" | "skipped";
	};
}

export const user = pgTable("user", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("email_verified").notNull(),
	image: text("image"),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
	role: text("role"),
	banned: boolean("banned"),
	banReason: text("ban_reason"),
	banExpires: timestamp("ban_expires"),
	preferences: json("preferences")
		.notNull()
		.$type<UserPreferencesType>()
		.default({}),
});

export type User = InferSelectModel<typeof user>;

export const session = pgTable("session", {
	id: uuid("id").primaryKey().defaultRandom(),
	expiresAt: timestamp("expires_at").notNull(),
	token: text("token").notNull().unique(),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: uuid("user_id")
		.notNull()
		.references(() => user.id),
	impersonatedBy: text("impersonated_by"),
	activeOrganizationId: uuid("active_organization_id"),
	activeCourseId: uuid("active_course_id"),
});

export type Session = InferSelectModel<typeof session>;

export const account = pgTable("account", {
	id: uuid("id").primaryKey().defaultRandom(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: uuid("user_id")
		.notNull()
		.references(() => user.id),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at"),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
	scope: text("scope"),
	password: text("password"),
	createdAt: timestamp("created_at").notNull(),
	updatedAt: timestamp("updated_at").notNull(),
});

export type Account = InferSelectModel<typeof account>;

export const verification = pgTable("verification", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: timestamp("expires_at").notNull(),
	createdAt: timestamp("created_at"),
	updatedAt: timestamp("updated_at"),
});

export type Verification = InferSelectModel<typeof verification>;

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
	createdAt: timestamp("created_at").notNull(),
});

export type Member = InferSelectModel<typeof member>;

export const invitation = pgTable("invitation", {
	id: text("id").primaryKey(),
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
});

export type Invitation = InferSelectModel<typeof invitation>;
