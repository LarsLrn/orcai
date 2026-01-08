CREATE TABLE IF NOT EXISTS "chat_branch" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL,
	"leaf_message_id" uuid NOT NULL,
	"name" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task" (
	"resource_id" text NOT NULL,
	"resource_type" text NOT NULL,
	"run_id" text PRIMARY KEY NOT NULL,
	"task" text NOT NULL,
	"payload" json,
	"run_count" integer,
	"public_access_token" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "zed_token" (
	"resource_id" uuid PRIMARY KEY NOT NULL,
	"resource_type" varchar(1024) NOT NULL,
	"zed_token" varchar(1024) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_message" ADD COLUMN "parent_message_id" uuid;--> statement-breakpoint
ALTER TABLE "chat_message" ADD COLUMN "depth" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_branch" ADD CONSTRAINT "chat_branch_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_branch" ADD CONSTRAINT "chat_branch_leaf_message_id_chat_message_id_fk" FOREIGN KEY ("leaf_message_id") REFERENCES "public"."chat_message"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_parent_message_id_chat_message_id_fk" FOREIGN KEY ("parent_message_id") REFERENCES "public"."chat_message"("id") ON DELETE set null ON UPDATE no action;