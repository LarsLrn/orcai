CREATE SEQUENCE "public"."embedding_generation_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "instance_settings" (
	"id" boolean PRIMARY KEY DEFAULT true,
	"embedding_generation" bigint,
	"embedding_base_url" text,
	"embedding_api_key_encrypted" text,
	"embedding_model" text,
	"embedding_dimensions" integer,
	"embedding_collection" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "instance_settings_singleton" CHECK ("id"),
	CONSTRAINT "instance_settings_embedding_complete" CHECK ((embedding_generation is null and embedding_base_url is null and embedding_api_key_encrypted is null and embedding_model is null and embedding_dimensions is null and embedding_collection is null) or (embedding_generation is not null and embedding_base_url is not null and embedding_api_key_encrypted is not null and embedding_model is not null and embedding_dimensions is not null and embedding_collection is not null))
);
--> statement-breakpoint
ALTER TABLE "block_asset" ADD COLUMN "embedding_generation" bigint;