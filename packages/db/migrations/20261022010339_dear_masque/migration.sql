CREATE TYPE "data_export_status" AS ENUM('pending', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE "data_export" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"status" "data_export_status" DEFAULT 'pending'::"data_export_status" NOT NULL,
	"size" bigint,
	"completed_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "data_export_user_in_flight_unique" ON "data_export" ("user_id") WHERE "status" in ('pending', 'processing');--> statement-breakpoint
CREATE INDEX "data_export_user_created_idx" ON "data_export" ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "data_export" ADD CONSTRAINT "data_export_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;