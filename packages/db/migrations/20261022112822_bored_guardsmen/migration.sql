ALTER TABLE "model" ADD COLUMN "input_price" numeric;--> statement-breakpoint
ALTER TABLE "model" ADD COLUMN "cache_read_price" numeric;--> statement-breakpoint
ALTER TABLE "model" ADD COLUMN "cache_write_price" numeric;--> statement-breakpoint
ALTER TABLE "model" ADD COLUMN "output_price" numeric;--> statement-breakpoint
ALTER TABLE "model" ADD COLUMN "request_price" numeric;--> statement-breakpoint
ALTER TABLE "model" ADD COLUMN "web_search_price" numeric;--> statement-breakpoint
ALTER TABLE "provider" ADD COLUMN "currency" char(3) DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "provider" ADD COLUMN "reports_cost" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "provider" ADD COLUMN "search_price" numeric;