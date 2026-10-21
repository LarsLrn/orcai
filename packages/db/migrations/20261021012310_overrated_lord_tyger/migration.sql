DROP INDEX "authz_outbox_retry_idx";--> statement-breakpoint
DROP INDEX "authz_outbox_processing_idx";--> statement-breakpoint
DROP INDEX "authz_outbox_pending_retry_idx";--> statement-breakpoint
DROP INDEX "authz_outbox_processing_stale_idx";--> statement-breakpoint
ALTER TABLE "authz_outbox" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "authz_outbox" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
UPDATE "authz_outbox" SET "status" = 'pending' WHERE "status" = 'processing';--> statement-breakpoint
DROP TYPE "authz_outbox_status";--> statement-breakpoint
CREATE TYPE "authz_outbox_status" AS ENUM('pending', 'processed', 'failed', 'dead_letter');--> statement-breakpoint
ALTER TABLE "authz_outbox" ALTER COLUMN "status" SET DATA TYPE "authz_outbox_status" USING "status"::"authz_outbox_status";--> statement-breakpoint
ALTER TABLE "authz_outbox" ALTER COLUMN "status" SET DEFAULT 'pending'::"authz_outbox_status";--> statement-breakpoint
CREATE INDEX "authz_outbox_undelivered_idx" ON "authz_outbox" ("seq") WHERE "status" IN ('pending', 'failed');