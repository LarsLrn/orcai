CREATE TYPE "asset_file_type" AS ENUM('pdf', 'jpeg', 'jpg', 'png', 'gif', 'webp', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'md');--> statement-breakpoint
ALTER TABLE "asset" ALTER COLUMN "file_type" SET DATA TYPE "asset_file_type" USING (
	CASE
		WHEN "file_type" LIKE 'image/jpeg%' THEN 'jpeg'
		WHEN "file_type" LIKE 'image/jpg%' THEN 'jpg'
		WHEN "file_type" LIKE 'image/png%' THEN 'png'
		WHEN "file_type" LIKE 'image/gif%' THEN 'gif'
		WHEN "file_type" LIKE 'image/webp%' THEN 'webp'
		WHEN "file_type" LIKE 'text/markdown%' THEN 'md'
		WHEN "file_type" LIKE 'text/plain%' THEN 'txt'
		WHEN "file_type" LIKE 'text/csv%' THEN 'csv'
		WHEN "file_type" LIKE 'application/pdf%' THEN 'pdf'
		WHEN "file_type" LIKE 'application/msword%' OR "file_type" LIKE 'application/x-msword%' THEN 'doc'
		WHEN "file_type" LIKE 'application/vnd.openxmlformats-officedocument.wordprocessingml.document%' THEN 'docx'
		WHEN "file_type" LIKE 'application/vnd.ms-excel%' OR "file_type" LIKE 'application/msexcel%' OR "file_type" LIKE 'application/x-msexcel%' OR "file_type" LIKE 'application/x-ms-excel%' THEN 'xls'
		WHEN "file_type" LIKE 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet%' THEN 'xlsx'
		WHEN "file_type" LIKE 'application/vnd.ms-powerpoint%' OR "file_type" LIKE 'application/mspowerpoint%' OR "file_type" LIKE 'application/powerpoint%' OR "file_type" LIKE 'application/x-mspowerpoint%' THEN 'ppt'
		WHEN "file_type" LIKE 'application/vnd.openxmlformats-officedocument.presentationml.presentation%' THEN 'pptx'
		ELSE "file_type"
	END
)::"asset_file_type";
