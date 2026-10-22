CREATE TYPE "quota_cost_source" AS ENUM('reported', 'estimated');--> statement-breakpoint
ALTER TABLE "quota_usage_event" ADD COLUMN "cost" bigint;--> statement-breakpoint
ALTER TABLE "quota_usage_event" ADD COLUMN "currency" char(3);--> statement-breakpoint
ALTER TABLE "quota_usage_event" ADD COLUMN "cost_source" "quota_cost_source";--> statement-breakpoint
ALTER TABLE "quota_usage_event" ADD CONSTRAINT "quota_usage_event_cost_complete" CHECK (("cost" is null) = ("currency" is null) and ("cost" is null) = ("cost_source" is null)) NOT VALID;