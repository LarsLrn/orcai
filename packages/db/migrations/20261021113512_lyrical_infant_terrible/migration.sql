ALTER TABLE "model" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
UPDATE "model" SET "updated_at" = "created_at";
