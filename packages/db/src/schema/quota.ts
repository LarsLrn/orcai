import type {
	GroupId,
	OrganizationId,
	ProviderId,
	QuotaLedgerId,
	QuotaPeriodId,
	QuotaPoolAuditLogId,
	QuotaPoolGroupAssignmentId,
	QuotaPoolId,
	QuotaUsageEventId,
	UserId,
} from "@orcai/core";
import { sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	index,
	integer,
	json,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { group } from "./authz";
import { model, provider, providerMeteringModeEnum } from "./model";
import { organization } from "./organization";

export const quotaPoolPeriodTypeEnum = pgEnum("quota_pool_period_type", [
	"weekly",
	"monthly",
	"yearly",
]);

export const quotaPeriodStatusEnum = pgEnum("quota_period_status", [
	"open",
	"closed",
]);

export const quotaUsageEventTypeEnum = pgEnum("quota_usage_event_type", [
	"reserved",
	"finalized",
	"released",
	"failed",
]);

export const quotaPool = pgTable(
	"quota_pool",
	{
		id: uuid("id").$type<QuotaPoolId>().primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.$type<OrganizationId>()
			.notNull()
			.references(() => organization.id, {
				onDelete: "cascade",
			}),
		name: text("name").notNull(),
		description: text("description"),
		providerId: uuid("provider_id")
			.$type<ProviderId>()
			.notNull()
			.references(() => provider.id, {
				onDelete: "cascade",
			}),
		providerModelId: uuid("provider_model_id").references(() => model.id, {
			onDelete: "set null",
		}),
		periodType: quotaPoolPeriodTypeEnum("period_type").notNull(),
		budgetAmount: bigint("budget_amount", {
			mode: "number",
		}).notNull(),
		priority: integer("priority").notNull().default(0),
		isDefault: boolean("is_default").notNull().default(false),
		isActive: boolean("is_active").notNull().default(true),
		createdByUserId: uuid("created_by_user_id")
			.$type<UserId>()
			.notNull()
			.references(() => user.id),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => [
		index("quota_pool_org_provider_idx").on(
			table.organizationId,
			table.providerId,
		),
		index("quota_pool_provider_model_idx").on(
			table.providerId,
			table.providerModelId,
		),
		uniqueIndex("quota_pool_default_org_provider_unique")
			.on(table.organizationId, table.providerId)
			.where(
				sql`${table.isDefault} = true AND ${table.providerModelId} IS NULL AND ${table.isActive} = true`,
			),
	],
);

export const quotaPoolGroupAssignment = pgTable(
	"quota_pool_group_assignment",
	{
		id: uuid("id")
			.$type<QuotaPoolGroupAssignmentId>()
			.primaryKey()
			.defaultRandom(),
		quotaPoolId: uuid("quota_pool_id")
			.$type<QuotaPoolId>()
			.notNull()
			.references(() => quotaPool.id, {
				onDelete: "cascade",
			}),
		groupId: uuid("group_id")
			.$type<GroupId>()
			.notNull()
			.references(() => group.id, {
				onDelete: "cascade",
			}),
		isActive: boolean("is_active").notNull().default(true),
		createdByUserId: uuid("created_by_user_id")
			.$type<UserId>()
			.notNull()
			.references(() => user.id),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => [
		index("quota_pool_group_assignment_pool_idx").on(table.quotaPoolId),
		index("quota_pool_group_assignment_group_idx").on(table.groupId),
		uniqueIndex("quota_pool_group_assignment_active_unique")
			.on(table.quotaPoolId, table.groupId)
			.where(sql`${table.isActive} = true`),
	],
);

export const quotaPeriod = pgTable(
	"quota_period",
	{
		id: uuid("id").$type<QuotaPeriodId>().primaryKey().defaultRandom(),
		quotaPoolId: uuid("quota_pool_id")
			.$type<QuotaPoolId>()
			.notNull()
			.references(() => quotaPool.id, {
				onDelete: "cascade",
			}),
		startsAt: timestamp("starts_at").notNull(),
		endsAt: timestamp("ends_at").notNull(),
		status: quotaPeriodStatusEnum("status").notNull().default("open"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		closedAt: timestamp("closed_at"),
	},
	(table) => [
		index("quota_period_pool_idx").on(table.quotaPoolId),
		uniqueIndex("quota_period_open_unique")
			.on(table.quotaPoolId)
			.where(sql`${table.status} = 'open'`),
	],
);

export const quotaLedger = pgTable(
	"quota_ledger",
	{
		id: uuid("id").$type<QuotaLedgerId>().primaryKey().defaultRandom(),
		quotaPoolId: uuid("quota_pool_id")
			.$type<QuotaPoolId>()
			.notNull()
			.references(() => quotaPool.id, {
				onDelete: "cascade",
			}),
		quotaPeriodId: uuid("quota_period_id")
			.$type<QuotaPeriodId>()
			.notNull()
			.references(() => quotaPeriod.id, {
				onDelete: "cascade",
			}),
		budgetAmount: bigint("budget_amount", {
			mode: "number",
		}).notNull(),
		reservedAmount: bigint("reserved_amount", {
			mode: "number",
		})
			.notNull()
			.default(0),
		consumedAmount: bigint("consumed_amount", {
			mode: "number",
		})
			.notNull()
			.default(0),
		remainingAmount: bigint("remaining_amount", {
			mode: "number",
		}).notNull(),
		version: bigint("version", {
			mode: "number",
		})
			.notNull()
			.default(0),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("quota_ledger_pool_period_unique").on(
			table.quotaPoolId,
			table.quotaPeriodId,
		),
		index("quota_ledger_period_idx").on(table.quotaPeriodId),
	],
);

export const quotaUsageEvent = pgTable(
	"quota_usage_event",
	{
		id: uuid("id").$type<QuotaUsageEventId>().primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.$type<OrganizationId>()
			.notNull()
			.references(() => organization.id, {
				onDelete: "cascade",
			}),
		quotaPoolId: uuid("quota_pool_id")
			.$type<QuotaPoolId>()
			.notNull()
			.references(() => quotaPool.id, {
				onDelete: "cascade",
			}),
		quotaPeriodId: uuid("quota_period_id")
			.$type<QuotaPeriodId>()
			.notNull()
			.references(() => quotaPeriod.id, {
				onDelete: "cascade",
			}),
		providerId: uuid("provider_id")
			.$type<ProviderId>()
			.notNull()
			.references(() => provider.id, {
				onDelete: "cascade",
			}),
		providerModelId: uuid("provider_model_id").references(() => model.id, {
			onDelete: "set null",
		}),
		userId: uuid("user_id")
			.$type<UserId>()
			.notNull()
			.references(() => user.id),
		appRequestId: text("app_request_id").notNull(),
		eventType: quotaUsageEventTypeEnum("event_type").notNull(),
		reservationKey: text("reservation_key").notNull(),
		meteringMode: providerMeteringModeEnum("metering_mode").notNull(),
		reservedAmount: bigint("reserved_amount", {
			mode: "number",
		})
			.notNull()
			.default(0),
		actualAmount: bigint("actual_amount", {
			mode: "number",
		})
			.notNull()
			.default(0),
		requestCount: integer("request_count"),
		inputTokens: bigint("input_tokens", {
			mode: "number",
		}),
		outputTokens: bigint("output_tokens", {
			mode: "number",
		}),
		totalTokens: bigint("total_tokens", {
			mode: "number",
		}),
		metadata: json("metadata").$type<Record<string, unknown>>(),
		occurredAt: timestamp("occurred_at").notNull().defaultNow(),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [
		index("quota_usage_event_pool_period_idx").on(
			table.quotaPoolId,
			table.quotaPeriodId,
			table.occurredAt,
		),
		index("quota_usage_event_app_request_idx").on(table.appRequestId),
		index("quota_usage_event_reservation_key_idx").on(table.reservationKey),
		uniqueIndex("quota_usage_event_terminal_unique")
			.on(table.reservationKey)
			.where(sql`${table.eventType} IN ('finalized', 'released')`),
		uniqueIndex("quota_usage_event_reservation_event_unique").on(
			table.reservationKey,
			table.eventType,
		),
	],
);

export const quotaPoolAuditLog = pgTable(
	"quota_pool_audit_log",
	{
		id: uuid("id").$type<QuotaPoolAuditLogId>().primaryKey().defaultRandom(),
		organizationId: uuid("organization_id")
			.$type<OrganizationId>()
			.notNull()
			.references(() => organization.id, {
				onDelete: "cascade",
			}),
		quotaPoolId: uuid("quota_pool_id")
			.$type<QuotaPoolId>()
			.notNull()
			.references(() => quotaPool.id, {
				onDelete: "cascade",
			}),
		actorUserId: uuid("actor_user_id")
			.$type<UserId>()
			.notNull()
			.references(() => user.id),
		actionType: text("action_type").notNull(),
		beforeState: json("before_state").$type<Record<string, unknown>>(),
		afterState: json("after_state").$type<Record<string, unknown>>(),
		createdAt: timestamp("created_at").notNull().defaultNow(),
	},
	(table) => [
		index("quota_pool_audit_log_pool_idx").on(
			table.quotaPoolId,
			table.createdAt,
		),
	],
);
