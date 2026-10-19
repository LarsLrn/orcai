ALTER TABLE "user" ADD COLUMN "locale" text;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_locale" CHECK ("locale" IN ('en', 'de'));