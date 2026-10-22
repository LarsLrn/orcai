CREATE TYPE "organization_web_search_mode" AS ENUM('off', 'native', 'provider');--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "web_search_mode" "organization_web_search_mode" DEFAULT 'off'::"organization_web_search_mode" NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "web_search_provider_id" uuid;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_web_search_provider_id_provider_id_fkey" FOREIGN KEY ("web_search_provider_id") REFERENCES "provider"("id") ON DELETE SET NULL;