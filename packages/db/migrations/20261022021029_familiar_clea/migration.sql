ALTER TABLE "quota_pool" RENAME COLUMN "provider_model_id" TO "model_id";--> statement-breakpoint
ALTER TABLE "quota_usage_event" RENAME COLUMN "provider_model_id" TO "model_id";--> statement-breakpoint
ALTER TABLE "quota_pool" RENAME CONSTRAINT "quota_pool_provider_model_id_model_id_fkey" TO "quota_pool_model_id_model_id_fkey";--> statement-breakpoint
ALTER TABLE "quota_usage_event" RENAME CONSTRAINT "quota_usage_event_provider_model_id_model_id_fkey" TO "quota_usage_event_model_id_model_id_fkey";--> statement-breakpoint
DROP INDEX "quota_pool_default_org_provider_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "quota_pool_default_org_provider_unique" ON "quota_pool" ("organization_id","provider_id") WHERE "is_default" = true AND "model_id" IS NULL AND "is_active" = true;--> statement-breakpoint
CREATE INDEX "quota_usage_event_model_idx" ON "quota_usage_event" ("model_id") WHERE "model_id" IS NOT NULL;