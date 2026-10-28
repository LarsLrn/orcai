CREATE TYPE "bot_setup_strength" AS ENUM('recommended', 'required');--> statement-breakpoint
CREATE TABLE "bot_setup" (
	"bot_id" uuid,
	"organization_id" uuid,
	"model_id" uuid,
	"strength" "bot_setup_strength" NOT NULL,
	"generation" json DEFAULT '{}' NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bot_setup_pkey" PRIMARY KEY("bot_id","organization_id")
);
--> statement-breakpoint
CREATE INDEX "bot_setup_organization_idx" ON "bot_setup" ("organization_id");--> statement-breakpoint
CREATE INDEX "bot_setup_model_idx" ON "bot_setup" ("model_id");--> statement-breakpoint
ALTER TABLE "bot_setup" ADD CONSTRAINT "bot_setup_bot_id_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bot"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "bot_setup" ADD CONSTRAINT "bot_setup_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "bot_setup" ADD CONSTRAINT "bot_setup_model_id_model_id_fkey" FOREIGN KEY ("model_id") REFERENCES "model"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "bot_setup" ADD CONSTRAINT "bot_setup_updated_by_user_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "user"("id") ON DELETE SET NULL;