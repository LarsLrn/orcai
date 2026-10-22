ALTER TABLE "quota_usage_event" ADD COLUMN "bot_id" uuid;--> statement-breakpoint
CREATE INDEX "quota_usage_event_org_finalized_idx" ON "quota_usage_event" ("organization_id","occurred_at") WHERE "event_type" = 'finalized';--> statement-breakpoint
CREATE INDEX "quota_usage_event_finalized_idx" ON "quota_usage_event" ("occurred_at") WHERE "event_type" = 'finalized';--> statement-breakpoint
CREATE INDEX "quota_usage_event_bot_idx" ON "quota_usage_event" ("bot_id") WHERE "bot_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "quota_usage_event" ADD CONSTRAINT "quota_usage_event_bot_id_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bot"("id") ON DELETE SET NULL;