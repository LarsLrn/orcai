CREATE TYPE "asset_origin" AS ENUM('library', 'chat');--> statement-breakpoint
ALTER TABLE "asset" ADD COLUMN "origin" "asset_origin" DEFAULT 'library'::"asset_origin" NOT NULL;