CREATE TABLE "block_asset" (
	"block_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "block" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"config" json NOT NULL,
	"user_id" uuid NOT NULL,
	"forked_from_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_block" (
	"block_id" uuid NOT NULL,
	"chat_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_block_block_id_chat_id_pk" PRIMARY KEY("block_id","chat_id")
);
--> statement-breakpoint
CREATE TABLE "bot_block" (
	"block_id" uuid NOT NULL,
	"bot_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bot_block_block_id_bot_id_pk" PRIMARY KEY("block_id","bot_id")
);
--> statement-breakpoint
CREATE TABLE "bot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" varchar(500) NOT NULL,
	"content_json" json DEFAULT '{}'::json NOT NULL,
	"content_html" text NOT NULL,
	"user_id" uuid NOT NULL,
	"forked_from_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "capability" (
	"capability" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" varchar(500) NOT NULL,
	CONSTRAINT "capability_capability_unique" UNIQUE("capability")
);
--> statement-breakpoint
CREATE TABLE "model_capability" (
	"model_id" uuid NOT NULL,
	"capability" text NOT NULL,
	CONSTRAINT "model_capability_model_id_capability_unique" UNIQUE("model_id","capability")
);
--> statement-breakpoint
CREATE TABLE "model" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"provider_slug" text NOT NULL,
	"name" text NOT NULL,
	"description" varchar(500) NOT NULL,
	"is_deprecated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "model_slug_provider_slug_unique" UNIQUE("slug","provider_slug")
);
--> statement-breakpoint
CREATE TABLE "organization_provider" (
	"organization_id" uuid NOT NULL,
	"provider_slug" text NOT NULL,
	"api_key_encrypted" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "organization_provider_organization_id_provider_slug_unique" UNIQUE("organization_id","provider_slug")
);
--> statement-breakpoint
CREATE TABLE "provider" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" varchar(500) NOT NULL,
	"website" text NOT NULL,
	"compatibility" text NOT NULL,
	"endpoint" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "provider_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "document" RENAME TO "asset";--> statement-breakpoint
ALTER TABLE "asset" RENAME COLUMN "uploaded_by" TO "user_id";--> statement-breakpoint
ALTER TABLE "chat" DROP CONSTRAINT "chat_course_id_course_id_fk";
--> statement-breakpoint
ALTER TABLE "asset" DROP CONSTRAINT "document_course_id_course_id_fk";
--> statement-breakpoint
ALTER TABLE "asset" DROP CONSTRAINT "document_uploaded_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "invitation" ALTER COLUMN "id" SET DATA TYPE uuid USING "id"::uuid;--> statement-breakpoint
ALTER TABLE "invitation" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "member" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "member" ALTER COLUMN "created_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invitation" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "invitation" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "chat_message" ADD COLUMN "metadata" json NOT NULL;--> statement-breakpoint
ALTER TABLE "chat" ADD COLUMN "bot_id" uuid;--> statement-breakpoint
ALTER TABLE "block_asset" ADD CONSTRAINT "block_asset_block_id_block_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."block"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block_asset" ADD CONSTRAINT "block_asset_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block" ADD CONSTRAINT "block_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "block" ADD CONSTRAINT "block_forked_from_id_block_id_fk" FOREIGN KEY ("forked_from_id") REFERENCES "public"."block"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_block" ADD CONSTRAINT "chat_block_block_id_block_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."block"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_block" ADD CONSTRAINT "chat_block_chat_id_chat_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_block" ADD CONSTRAINT "bot_block_block_id_block_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."block"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_block" ADD CONSTRAINT "bot_block_bot_id_bot_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bot"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot" ADD CONSTRAINT "bot_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot" ADD CONSTRAINT "bot_forked_from_id_bot_id_fk" FOREIGN KEY ("forked_from_id") REFERENCES "public"."bot"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_capability" ADD CONSTRAINT "model_capability_model_id_model_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."model"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_capability" ADD CONSTRAINT "model_capability_capability_capability_capability_fk" FOREIGN KEY ("capability") REFERENCES "public"."capability"("capability") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model" ADD CONSTRAINT "model_provider_slug_provider_slug_fk" FOREIGN KEY ("provider_slug") REFERENCES "public"."provider"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_provider" ADD CONSTRAINT "organization_provider_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_provider" ADD CONSTRAINT "organization_provider_provider_slug_provider_slug_fk" FOREIGN KEY ("provider_slug") REFERENCES "public"."provider"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat" ADD CONSTRAINT "chat_bot_id_bot_id_fk" FOREIGN KEY ("bot_id") REFERENCES "public"."bot"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "asset" ADD CONSTRAINT "asset_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" DROP COLUMN "active_course_id";--> statement-breakpoint
ALTER TABLE "chat_message" DROP COLUMN "annotations";--> statement-breakpoint
ALTER TABLE "chat" DROP COLUMN "course_id";--> statement-breakpoint
ALTER TABLE "asset" DROP COLUMN "course_id";--> statement-breakpoint
ALTER TABLE "asset" DROP COLUMN "status";