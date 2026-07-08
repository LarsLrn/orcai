ALTER TABLE "invitation" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "member" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
UPDATE "invitation" SET "role" = CASE "role"
	WHEN 'owner' THEN 'admin'
	WHEN 'instructor' THEN 'manager'
	WHEN 'student' THEN 'member'
	ELSE "role"
END;--> statement-breakpoint
UPDATE "member" SET "role" = CASE "role"
	WHEN 'owner' THEN 'admin'
	WHEN 'instructor' THEN 'manager'
	WHEN 'student' THEN 'member'
	ELSE "role"
END;--> statement-breakpoint
DROP TYPE "organization_role";--> statement-breakpoint
CREATE TYPE "organization_role" AS ENUM('admin', 'manager', 'member', 'viewer');--> statement-breakpoint
ALTER TABLE "invitation" ALTER COLUMN "role" SET DATA TYPE "organization_role" USING "role"::"organization_role";--> statement-breakpoint
ALTER TABLE "member" ALTER COLUMN "role" SET DATA TYPE "organization_role" USING "role"::"organization_role";
