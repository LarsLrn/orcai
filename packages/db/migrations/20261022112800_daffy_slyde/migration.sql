ALTER TABLE "quota_usage_event" ADD COLUMN "no_cache_input_tokens" bigint;--> statement-breakpoint
ALTER TABLE "quota_usage_event" ADD COLUMN "cache_read_tokens" bigint;--> statement-breakpoint
ALTER TABLE "quota_usage_event" ADD COLUMN "cache_write_tokens" bigint;--> statement-breakpoint
ALTER TABLE "quota_usage_event" ADD COLUMN "reasoning_tokens" bigint;--> statement-breakpoint
ALTER TABLE "quota_usage_event" ADD COLUMN "web_search_count" integer;