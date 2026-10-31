import {
	type MemberId,
	type ModelId,
	type OrganizationId,
	type OrganizationInvitationId,
	type ProviderId,
	type UserId,
	webSearchModes,
} from "@orcai/core";
import type {
	OrganizationDescription,
	OrganizationInvitationStatus,
} from "@orcai/schema";
import {
	type AnyPgColumn,
	index,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { model, provider } from "./model";

export const organizationRoleEnum = pgEnum("organization_role", [
	"admin",
	"manager",
	"member",
	"viewer",
]);

export const organizationWebSearchModeEnum = pgEnum(
	"organization_web_search_mode",
	webSearchModes,
);

export const organization = pgTable("organization", {
	id: uuid("id").$type<OrganizationId>().primaryKey().defaultRandom(),
	name: text("name").notNull(),
	slug: text("slug").unique().notNull(),
	logo: text("logo"),
	description: jsonb("description").$type<OrganizationDescription>(),
	createdAt: timestamp("created_at").notNull(),
	metadata: text("metadata"),
	assistantModelId: uuid("assistant_model_id")
		.$type<ModelId>()
		.references((): AnyPgColumn => model.id, {
			onDelete: "set null",
		}),
	utilityModelId: uuid("utility_model_id")
		.$type<ModelId>()
		.references((): AnyPgColumn => model.id, {
			onDelete: "set null",
		}),
	defaultChatModelId: uuid("default_chat_model_id")
		.$type<ModelId>()
		.references((): AnyPgColumn => model.id, {
			onDelete: "set null",
		}),
	webSearchMode: organizationWebSearchModeEnum("web_search_mode")
		.notNull()
		.default("off"),
	webSearchProviderId: uuid("web_search_provider_id")
		.$type<ProviderId>()
		.references((): AnyPgColumn => provider.id, {
			onDelete: "set null",
		}),
});

export const member = pgTable(
	"member",
	{
		id: uuid("id").$type<MemberId>().primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.$type<OrganizationId>()
			.notNull()
			.references(() => organization.id, {
				onDelete: "cascade",
			}),
		userId: uuid("user_id")
			.$type<UserId>()
			.notNull()
			.references(() => user.id),
		role: organizationRoleEnum("role").notNull(),
		createdAt: timestamp("created_at").defaultNow(),
	},
	(table) => [
		index("member_org_user_idx").on(table.organizationId, table.userId),
	],
);

export const invitation = pgTable("invitation", {
	id: uuid("id").$type<OrganizationInvitationId>().primaryKey().defaultRandom(),
	organizationId: uuid("organization_id")
		.$type<OrganizationId>()
		.notNull()
		.references(() => organization.id, {
			onDelete: "cascade",
		}),
	email: text("email").notNull(),
	role: organizationRoleEnum("role").notNull(),
	status: text("status").notNull().$type<OrganizationInvitationStatus>(),
	expiresAt: timestamp("expires_at").notNull(),
	inviterId: uuid("inviter_id")
		.$type<UserId>()
		.references(() => user.id, {
			onDelete: "set null",
		}),
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
});
