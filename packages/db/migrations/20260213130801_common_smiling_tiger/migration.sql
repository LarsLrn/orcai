ALTER TABLE "model" DROP CONSTRAINT "model_provider_slug_provider_slug_fk";--> statement-breakpoint
ALTER TABLE "model_capability" DROP CONSTRAINT "model_capability_capability_capability_capability_fk";--> statement-breakpoint
DROP TABLE "capability";--> statement-breakpoint
DROP TABLE "model_capability";--> statement-breakpoint
DROP TABLE "organization_provider";--> statement-breakpoint
ALTER TABLE "model" DROP CONSTRAINT "model_slug_provider_slug_unique";--> statement-breakpoint
ALTER TABLE "provider" DROP CONSTRAINT "provider_slug_unique";--> statement-breakpoint
ALTER TABLE "model" ADD COLUMN "provider_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "model" ADD COLUMN "provider_model_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "model" ADD COLUMN "capability" text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "provider" ADD COLUMN "id" uuid DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "provider" ADD COLUMN "api_key_encrypted" text NOT NULL;--> statement-breakpoint
ALTER TABLE "provider" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "provider" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "model" DROP COLUMN "slug";--> statement-breakpoint
ALTER TABLE "model" DROP COLUMN "provider_slug";--> statement-breakpoint
ALTER TABLE "provider" DROP COLUMN "slug";--> statement-breakpoint
ALTER TABLE "provider" DROP COLUMN "website";--> statement-breakpoint
ALTER TABLE "provider" DROP COLUMN "version";--> statement-breakpoint
ALTER TABLE "provider" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "provider" ALTER COLUMN "endpoint" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "model" ADD CONSTRAINT "model_provider_id_provider_id_fkey" FOREIGN KEY ("provider_id") REFERENCES "provider"("id") ON DELETE CASCADE;