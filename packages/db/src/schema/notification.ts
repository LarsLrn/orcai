import { sql } from "drizzle-orm";
import {
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";

export const notificationOutboxStatusEnum = pgEnum(
	"notification_outbox_status",
	[
		"pending",
		"processing",
		"sent",
		"dead",
	],
);

export const notificationOutbox = pgTable(
	"notification_outbox",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		type: text("type").notNull(),
		recipient: text("recipient").notNull(),
		payloadVersion: integer("payload_version").notNull().default(1),
		payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
		deduplicationKey: text("deduplication_key").notNull(),
		status: notificationOutboxStatusEnum("status").notNull().default("pending"),
		attempts: integer("attempts").notNull().default(0),
		nextAttemptAt: timestamp("next_attempt_at").notNull().defaultNow(),
		leaseExpiresAt: timestamp("lease_expires_at"),
		lastError: text("last_error"),
		providerMessageId: text("provider_message_id"),
		sentAt: timestamp("sent_at"),
		createdAt: timestamp("created_at").notNull().defaultNow(),
		updatedAt: timestamp("updated_at").notNull().defaultNow(),
	},
	(table) => [
		uniqueIndex("notification_outbox_deduplication_key_unique").on(
			table.deduplicationKey,
		),
		index("notification_outbox_due_idx")
			.on(table.nextAttemptAt, table.createdAt)
			.where(sql`${table.status} = 'pending'`),
		index("notification_outbox_lease_idx")
			.on(table.leaseExpiresAt)
			.where(sql`${table.status} = 'processing'`),
		index("notification_outbox_sent_idx")
			.on(table.sentAt)
			.where(sql`${table.status} = 'sent'`),
	],
);
