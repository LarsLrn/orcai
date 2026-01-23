/**
 * Backfill Migration Script for Chat Branching
 *
 * This script migrates existing linear chat conversations to the new branching structure:
 * 1. Sets parentMessageId for each message to point to the previous message
 * 2. Sets depth for each message based on its position in the conversation
 * 3. Creates a default "Main" branch for each chat pointing to the last message
 *
 * Run this AFTER applying the schema migration (0006_illegal_wasp.sql)
 */

import "dotenv/config";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { pgConnectionString } from "@/settings/db";
import { chat } from "../src/db/schema/chat";
import { chatBranch } from "../src/db/schema/chat-branch";
import { chatMessage } from "../src/db/schema/chat-message";

const db = drizzle(pgConnectionString);

async function backfillChatBranches() {
	console.log("🚀 Starting chat branching backfill migration...\n");

	try {
		// Get all chats
		const chats = await db.select().from(chat);
		console.log(`Found ${chats.length} chats to process\n`);

		let processedChats = 0;
		let totalMessagesUpdated = 0;
		let branchesCreated = 0;

		for (const chatRecord of chats) {
			console.log(`Processing chat ${chatRecord.id}...`);

			// Get all messages for this chat, ordered by creation time
			const messages = await db
				.select()
				.from(chatMessage)
				.where(eq(chatMessage.chatId, chatRecord.id))
				.orderBy(asc(chatMessage.createdAt));

			if (messages.length === 0) {
				console.log("  ⚠️  No messages found, skipping\n");
				continue;
			}

			console.log(`  Found ${messages.length} messages`);

			// Update each message with parent pointer and depth
			for (let i = 0; i < messages.length; i++) {
				const message = messages[i];
				const parentMessage = i > 0 ? messages[i - 1] : null;

				await db
					.update(chatMessage)
					.set({
						parentMessageId: parentMessage?.id ?? null,
						depth: i,
					})
					.where(eq(chatMessage.id, message.id));

				totalMessagesUpdated++;
			}

			console.log(
				`  ✓ Updated ${messages.length} messages with parent pointers and depth`,
			);

			// Create default "Main" branch pointing to the last message
			const lastMessage = messages[messages.length - 1];
			const [newBranch] = await db
				.insert(chatBranch)
				.values({
					chatId: chatRecord.id,
					name: "Main",
					leafMessageId: lastMessage.id,
				})
				.returning();

			// Set the Main branch as the active branch for this chat
			await db
				.update(chat)
				.set({ activeBranchId: newBranch.id })
				.where(eq(chat.id, chatRecord.id));

			branchesCreated++;
			processedChats++;
			console.log(`  ✓ Created "Main" branch and set as active\n`);
		}

		console.log("✅ Migration completed successfully!");
		console.log("\nSummary:");
		console.log(`  - Chats processed: ${processedChats}`);
		console.log(`  - Messages updated: ${totalMessagesUpdated}`);
		console.log(`  - Branches created: ${branchesCreated}`);
	} catch (error) {
		console.error("❌ Migration failed:", error);
		throw error;
	}
}

// Run the migration
backfillChatBranches()
	.then(() => {
		console.log("\n🎉 All done!");
		process.exit(0);
	})
	.catch((error) => {
		console.error("\n💥 Fatal error:", error);
		process.exit(1);
	});
