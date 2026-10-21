CREATE TYPE "chat_message_rating_value" AS ENUM('very_much', 'a_bit', 'not_really', 'not_at_all');--> statement-breakpoint
CREATE TABLE "chat_message_rating" (
	"message_id" uuid,
	"user_id" uuid,
	"rating" "chat_message_rating_value" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_message_rating_pkey" PRIMARY KEY("message_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "chat_message_rating" ADD CONSTRAINT "chat_message_rating_message_id_chat_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "chat_message"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "chat_message_rating" ADD CONSTRAINT "chat_message_rating_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;