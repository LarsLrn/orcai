CREATE TYPE "notification_delivery_channel" AS ENUM('smtp', 'log');--> statement-breakpoint
ALTER TABLE "notification_outbox" ADD COLUMN "delivery_channel" "notification_delivery_channel";