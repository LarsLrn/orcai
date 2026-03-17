ALTER TABLE "block" ADD COLUMN "description" varchar(500);--> statement-breakpoint
ALTER TABLE "block" ADD COLUMN "content_json" json;--> statement-breakpoint
ALTER TABLE "block" ADD COLUMN "content_html" text;