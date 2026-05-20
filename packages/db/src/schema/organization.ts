import type {
	MemberId,
	OrganizationId,
	OrganizationInvitationId,
	UserId,
} from "@orcai/core";
import type { OrganizationInvitationStatus } from "@orcai/schema";
import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const organizationRoleEnum = pgEnum("organization_role", [
	"owner",
	"instructor",
	"student",
]);

export const organization = pgTable("organization", {
	id: uuid("id").$type<OrganizationId>().primaryKey().defaultRandom(),
	name: text("name").notNull(),
	slug: text("slug").unique().notNull(),
	logo: text("logo"),
	createdAt: timestamp("created_at").notNull(),
	metadata: text("metadata"),
});

export const member = pgTable("member", {
	id: uuid("id").$type<MemberId>().primaryKey().defaultRandom(),
	organizationId: uuid("organization_id")
		.$type<OrganizationId>()
		.notNull()
		.references(() => organization.id),
	userId: uuid("user_id")
		.$type<UserId>()
		.notNull()
		.references(() => user.id),
	role: organizationRoleEnum("role").notNull(),
	createdAt: timestamp("created_at").defaultNow(),
});

export const invitation = pgTable("invitation", {
	id: uuid("id").$type<OrganizationInvitationId>().primaryKey().defaultRandom(),
	organizationId: uuid("organization_id")
		.$type<OrganizationId>()
		.notNull()
		.references(() => organization.id),
	email: text("email").notNull(),
	role: organizationRoleEnum("role").notNull(),
	status: text("status").notNull().$type<OrganizationInvitationStatus>(),
	expiresAt: timestamp("expires_at").notNull(),
	inviterId: uuid("inviter_id")
		.$type<UserId>()
		.notNull()
		.references(() => user.id),
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
});
