CREATE TYPE "chat_kind" AS ENUM('chat', 'assistant');--> statement-breakpoint
ALTER TABLE "chat" ADD COLUMN "kind" "chat_kind" DEFAULT 'chat'::"chat_kind" NOT NULL;--> statement-breakpoint
ALTER TABLE "chat" ADD COLUMN "organization_id" uuid;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN "assistant_model_id" uuid;--> statement-breakpoint
CREATE INDEX "chat_organization_user_updated_idx" ON "chat" ("organization_id","user_id","updated_at");--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_assistant_model_id_model_id_fkey" FOREIGN KEY ("assistant_model_id") REFERENCES "model"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_assistant_shape" CHECK (("kind" = 'assistant') = ("organization_id" IS NOT NULL) AND ("kind" <> 'assistant' OR ("bot_id" IS NULL AND "parent_chat_id" IS NULL)));