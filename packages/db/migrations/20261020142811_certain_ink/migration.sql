ALTER TABLE "provider" RENAME COLUMN "compatibility" TO "kind";--> statement-breakpoint
UPDATE "provider" SET "kind" = 'openai-compatible' WHERE "kind" = 'openai';--> statement-breakpoint
ALTER TABLE "provider" ALTER COLUMN "endpoint" DROP NOT NULL;
