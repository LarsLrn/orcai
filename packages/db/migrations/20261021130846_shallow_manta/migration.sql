CREATE TABLE "bot_favourite" (
	"user_id" uuid,
	"bot_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bot_favourite_pkey" PRIMARY KEY("user_id","bot_id")
);
--> statement-breakpoint
CREATE INDEX "bot_favourite_bot_idx" ON "bot_favourite" ("bot_id");--> statement-breakpoint
ALTER TABLE "bot_favourite" ADD CONSTRAINT "bot_favourite_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "bot_favourite" ADD CONSTRAINT "bot_favourite_bot_id_bot_id_fkey" FOREIGN KEY ("bot_id") REFERENCES "bot"("id") ON DELETE CASCADE;