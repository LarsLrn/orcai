ALTER TABLE "chat_message" ADD COLUMN "position" integer;--> statement-breakpoint
ALTER TABLE "chat" ADD COLUMN "parent_chat_id" uuid;--> statement-breakpoint
ALTER TABLE "chat" ADD COLUMN "branched_from_message_id" uuid;--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_parent_chat_id_chat_id_fkey" FOREIGN KEY ("parent_chat_id") REFERENCES "chat"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_branched_from_message_id_chat_message_id_fkey" FOREIGN KEY ("branched_from_message_id") REFERENCES "chat_message"("id") ON DELETE SET NULL;