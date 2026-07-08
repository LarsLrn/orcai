CREATE TYPE "notification_outbox_status" AS ENUM('pending', 'processing', 'sent', 'dead');--> statement-breakpoint
CREATE TABLE "notification_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"type" text NOT NULL,
	"recipient" text NOT NULL,
	"payload_version" integer DEFAULT 1 NOT NULL,
	"payload" jsonb NOT NULL,
	"deduplication_key" text NOT NULL,
	"status" "notification_outbox_status" DEFAULT 'pending'::"notification_outbox_status" NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp DEFAULT now() NOT NULL,
	"lease_expires_at" timestamp,
	"last_error" text,
	"provider_message_id" text,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "notification_outbox_deduplication_key_unique" ON "notification_outbox" ("deduplication_key");--> statement-breakpoint
CREATE INDEX "notification_outbox_due_idx" ON "notification_outbox" ("next_attempt_at","created_at") WHERE "status" = 'pending';--> statement-breakpoint
CREATE INDEX "notification_outbox_lease_idx" ON "notification_outbox" ("lease_expires_at") WHERE "status" = 'processing';--> statement-breakpoint
CREATE INDEX "notification_outbox_sent_idx" ON "notification_outbox" ("sent_at") WHERE "status" = 'sent';