import type {
	GroupId,
	GroupMemberId,
	OrganizationId,
	UserId,
} from "@orcai/core";
import { sql } from "drizzle-orm";
import {
	boolean,
	index,
	integer,
	json,
	pgEnum,
	pgTable,
	serial,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { organization } from "./organization";

export const resourceTypeEnum = pgEnum("resource_type", [
	"bot",
	"block",
	"asset",
]);

export const resourceGrantRoleEnum = pgEnum("resource_grant_role", [
	"viewer",
	"editor",
	"manager",
]);

export const principalTypeEnum = pgEnum("principal_type", [
	"user",
	"group",
]);

export const groupKindEnum = pgEnum("group_kind", [
	"system",
	"custom",
]);

export const groupSystemKeyEnum = pgEnum("group_system_key", [
	"all_members",
]);

export const resourceVisibilityEnum = pgEnum("resource_visibility_enum", [
	"private",
	"public",
]);

export const authzOutboxStatusEnum = pgEnum("authz_outbox_status", [
	"pending",
	"processing",
	"processed",
	"failed",
]);

export const group = pgTable(
	"group",
	{
		id: uuid("id").$type<GroupId>().primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.$type<OrganizationId>()
			.notNull()
			.references(() => organization.id, {
				onDelete: "cascade",
			}),
		name: text("name").notNull(),
		description: text("description"),
		kind: groupKindEnum("kind").notNull(),
		systemKey: groupSystemKeyEnum("system_key"),
		createdBy: uuid("created_by")
			.$type<UserId>()
			.notNull()
			.references(() => user.id),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
		deletedAt: timestamp("deleted_at"),
	},
	(table) => [
		index("group_org_idx").on(table.organizationId),
		uniqueIndex("group_org_name_unique")
			.on(table.organizationId, sql`lower(${table.name})`)
			.where(sql`${table.deletedAt} IS NULL`),
		uniqueIndex("group_org_system_key_unique")
			.on(table.organizationId, table.systemKey)
			.where(
				sql`${table.systemKey} IS NOT NULL AND ${table.deletedAt} IS NULL`,
			),
	],
);

export const groupMember = pgTable(
	"group_member",
	{
		id: uuid("id").$type<GroupMemberId>().primaryKey().defaultRandom(),
		groupId: uuid("group_id")
			.$type<GroupId>()
			.notNull()
			.references(() => group.id, {
				onDelete: "cascade",
			}),
		userId: uuid("user_id")
			.$type<UserId>()
			.notNull()
			.references(() => user.id, {
				onDelete: "cascade",
			}),
		addedBy: uuid("added_by")
			.$type<UserId>()
			.notNull()
			.references(() => user.id),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		removedAt: timestamp("removed_at"),
	},
	(table) => [
		index("group_member_group_idx").on(table.groupId),
		index("group_member_user_idx").on(table.userId),
		uniqueIndex("group_member_active_unique")
			.on(table.groupId, table.userId)
			.where(sql`${table.removedAt} IS NULL`),
	],
);

export const resourceGrant = pgTable(
	"resource_grant",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		resourceType: resourceTypeEnum("resource_type").notNull(),
		resourceId: uuid("resource_id").notNull(),
		principalType: principalTypeEnum("principal_type").notNull(),
		principalId: uuid("principal_id").$type<UserId | GroupId>().notNull(),
		role: resourceGrantRoleEnum("role").notNull(),
		grantedBy: uuid("granted_by")
			.$type<UserId>()
			.notNull()
			.references(() => user.id),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		revokedAt: timestamp("revoked_at"),
	},
	(table) => [
		index("resource_grant_resource_idx").on(
			table.resourceType,
			table.resourceId,
		),
		index("resource_grant_principal_idx").on(
			table.principalType,
			table.principalId,
		),
		uniqueIndex("resource_grant_active_principal_unique")
			.on(
				table.resourceType,
				table.resourceId,
				table.principalType,
				table.principalId,
			)
			.where(sql`${table.revokedAt} IS NULL`),
	],
);

export const resourceVisibility = pgTable(
	"resource_visibility",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		resourceType: resourceTypeEnum("resource_type").notNull(),
		resourceId: uuid("resource_id").notNull(),
		visibility: resourceVisibilityEnum("visibility")
			.notNull()
			.default("private"),
		updatedBy: uuid("updated_by")
			.$type<UserId>()
			.notNull()
			.references(() => user.id),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("resource_visibility_resource_unique").on(
			table.resourceType,
			table.resourceId,
		),
		index("resource_visibility_resource_idx").on(
			table.resourceType,
			table.resourceId,
		),
	],
);

export const resourceScope = pgTable(
	"resource_scope",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		resourceType: resourceTypeEnum("resource_type").notNull(),
		resourceId: uuid("resource_id").notNull(),
		organizationId: uuid("organization_id")
			.$type<OrganizationId>()
			.notNull()
			.references(() => organization.id, {
				onDelete: "cascade",
			}),
		isPrimary: boolean("is_primary").notNull().default(true),
		assignedAt: timestamp("assigned_at").notNull().defaultNow(),
		assignedBy: uuid("assigned_by")
			.$type<UserId>()
			.notNull()
			.references(() => user.id),
		endedAt: timestamp("ended_at"),
	},
	(table) => [
		index("resource_scope_resource_idx").on(
			table.resourceType,
			table.resourceId,
		),
		index("resource_scope_org_idx").on(table.organizationId),
	],
);

export const authzOutbox = pgTable(
	"authz_outbox",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		seq: serial("seq").notNull(),
		eventType: text("event_type").notNull(),
		payloadJson: json("payload_json")
			.notNull()
			.$type<Record<string, unknown>>(),
		status: authzOutboxStatusEnum("status").notNull().default("pending"),
		attempts: integer("attempts").notNull().default(0),
		nextAttemptAt: timestamp("next_attempt_at"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => [
		index("authz_outbox_status_idx").on(table.status, table.createdAt),
		uniqueIndex("authz_outbox_seq_unique").on(table.seq),
		index("authz_outbox_retry_idx").on(
			table.status,
			table.nextAttemptAt,
			table.seq,
		),
		index("authz_outbox_processing_idx").on(
			table.status,
			table.updatedAt,
			table.seq,
		),
		index("authz_outbox_pending_retry_idx")
			.on(table.nextAttemptAt, table.seq)
			.where(sql`${table.status} IN ('pending', 'failed')`),
		index("authz_outbox_processing_stale_idx")
			.on(table.updatedAt, table.seq)
			.where(sql`${table.status} = 'processing'`),
	],
);
