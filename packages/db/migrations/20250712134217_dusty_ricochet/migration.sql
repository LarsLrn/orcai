ALTER TABLE "course" RENAME COLUMN "content" TO "content_json";--> statement-breakpoint
ALTER TABLE "course_member" DROP CONSTRAINT "course_member_course_id_course_id_fk";
--> statement-breakpoint
ALTER TABLE "course" ADD COLUMN "content_html" text NOT NULL;--> statement-breakpoint
ALTER TABLE "course_member" ADD CONSTRAINT "course_member_course_id_course_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."course"("id") ON DELETE cascade ON UPDATE no action;