ALTER TABLE "block" RENAME CONSTRAINT "block_user_id_user_id_fk" TO "block_user_id_user_id_fkey";--> statement-breakpoint
ALTER TABLE "bot" RENAME CONSTRAINT "bot_user_id_user_id_fk" TO "bot_user_id_user_id_fkey";--> statement-breakpoint
ALTER TABLE "invitation" RENAME CONSTRAINT "invitation_inviter_id_user_id_fk" TO "invitation_inviter_id_user_id_fkey";--> statement-breakpoint
ALTER TABLE "invitation" ALTER COLUMN "inviter_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "group" ALTER COLUMN "created_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "group_member" ALTER COLUMN "added_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "resource_grant" ALTER COLUMN "granted_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "resource_scope" ALTER COLUMN "assigned_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "resource_visibility" ALTER COLUMN "updated_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "quota_pool" ALTER COLUMN "created_by_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "quota_pool_audit_log" ALTER COLUMN "actor_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "quota_pool_group_assignment" ALTER COLUMN "created_by_user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "quota_usage_event" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invitation" DROP CONSTRAINT "invitation_inviter_id_user_id_fkey", ADD CONSTRAINT "invitation_inviter_id_user_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "block" DROP CONSTRAINT "block_user_id_user_id_fkey", ADD CONSTRAINT "block_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "bot" DROP CONSTRAINT "bot_user_id_user_id_fkey", ADD CONSTRAINT "bot_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id");--> statement-breakpoint
ALTER TABLE "group" DROP CONSTRAINT "group_created_by_user_id_fkey", ADD CONSTRAINT "group_created_by_user_id_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "group_member" DROP CONSTRAINT "group_member_added_by_user_id_fkey", ADD CONSTRAINT "group_member_added_by_user_id_fkey" FOREIGN KEY ("added_by") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "resource_grant" DROP CONSTRAINT "resource_grant_granted_by_user_id_fkey", ADD CONSTRAINT "resource_grant_granted_by_user_id_fkey" FOREIGN KEY ("granted_by") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "resource_scope" DROP CONSTRAINT "resource_scope_assigned_by_user_id_fkey", ADD CONSTRAINT "resource_scope_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "resource_visibility" DROP CONSTRAINT "resource_visibility_updated_by_user_id_fkey", ADD CONSTRAINT "resource_visibility_updated_by_user_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "quota_pool" DROP CONSTRAINT "quota_pool_created_by_user_id_user_id_fkey", ADD CONSTRAINT "quota_pool_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "quota_pool_audit_log" DROP CONSTRAINT "quota_pool_audit_log_actor_user_id_user_id_fkey", ADD CONSTRAINT "quota_pool_audit_log_actor_user_id_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "quota_pool_group_assignment" DROP CONSTRAINT "quota_pool_group_assignment_created_by_user_id_user_id_fkey", ADD CONSTRAINT "quota_pool_group_assignment_created_by_user_id_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "quota_usage_event" DROP CONSTRAINT "quota_usage_event_user_id_user_id_fkey", ADD CONSTRAINT "quota_usage_event_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE SET NULL;