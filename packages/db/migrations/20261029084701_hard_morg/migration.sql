ALTER TABLE "model" ALTER COLUMN "capability" DROP NOT NULL;--> statement-breakpoint
-- Discovery stored no capabilities as an empty list; a model with none serves nothing, so none means not set yet.
UPDATE "model" SET "capability" = NULL WHERE cardinality("capability") = 0;
