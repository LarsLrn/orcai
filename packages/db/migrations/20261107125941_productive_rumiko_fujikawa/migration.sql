CREATE TABLE "deleted_asset" (
	"id" uuid PRIMARY KEY,
	"deleted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deletion_cleanup" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"data" jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp NOT NULL,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "deleted_asset_deleted_at_idx" ON "deleted_asset" ("deleted_at");--> statement-breakpoint
CREATE INDEX "deletion_cleanup_due_idx" ON "deletion_cleanup" ("next_attempt_at");