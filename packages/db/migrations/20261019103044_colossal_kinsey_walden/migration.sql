ALTER TABLE "chat_message" DROP CONSTRAINT "chat_message_parent_message_id_chat_message_id_fk";--> statement-breakpoint
ALTER TABLE "chat" DROP CONSTRAINT "chat_active_branch_id_chat_branch_id_fk";--> statement-breakpoint
DROP TABLE "chat_branch";--> statement-breakpoint
ALTER TABLE "chat_message" DROP COLUMN "parent_message_id";--> statement-breakpoint
ALTER TABLE "chat_message" DROP COLUMN "depth";--> statement-breakpoint
ALTER TABLE "chat" DROP COLUMN "active_branch_id";--> statement-breakpoint
ALTER TABLE "chat_message" ALTER COLUMN "position" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "chat_message_chat_position_unique" ON "chat_message" ("chat_id","position");