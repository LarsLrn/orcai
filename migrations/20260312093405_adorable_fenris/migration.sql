ALTER TABLE "block" ADD COLUMN "status" text DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE "bot" ADD COLUMN "status" text DEFAULT 'ready' NOT NULL;