ALTER TYPE "authz_outbox_status" ADD VALUE 'dead_letter';--> statement-breakpoint
ALTER TABLE "invitation" RENAME CONSTRAINT "invitation_organization_id_organization_id_fk" TO "invitation_organization_id_organization_id_fkey";--> statement-breakpoint
ALTER TABLE "member" RENAME CONSTRAINT "member_organization_id_organization_id_fk" TO "member_organization_id_organization_id_fkey";--> statement-breakpoint
UPDATE "user" SET "role" = 'user' WHERE "role" IS NULL OR "role" NOT IN ('admin','user');--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'user';--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "role" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "member_org_user_idx" ON "member" ("organization_id","user_id");--> statement-breakpoint
ALTER TABLE "invitation" DROP CONSTRAINT "invitation_organization_id_organization_id_fkey", ADD CONSTRAINT "invitation_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "member" DROP CONSTRAINT "member_organization_id_organization_id_fkey", ADD CONSTRAINT "member_organization_id_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_instance_role" CHECK ("role" IN ('admin', 'user'));
