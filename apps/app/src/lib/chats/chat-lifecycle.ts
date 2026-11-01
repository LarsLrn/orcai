import { DB, dbSchema } from "@orcai/db";
import type { SQL } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { RelationshipFact } from "@/lib/authz/relationship-facts";
import { recordRelationshipFacts } from "@/lib/authz/relationship-write";
import { lockExistingResource } from "@/lib/authz/resource-lifecycle";
import * as AppErrors from "@/lib/effect/utils/errors";

/** Inserts a chat and records its owner and bot; call it in a `writeRelationships`. */
export const insertChat = (values: typeof dbSchema.chat.$inferInsert) =>
	Effect.gen(function* () {
		const db = yield* DB;
		// Held until commit, so a bot deletion marks this chat or refuses it.
		if (
			values.botId &&
			!(yield* lockExistingResource({
				resourceType: "bot",
				resourceId: values.botId,
			}))
		) {
			return yield* new AppErrors.NotFoundError({
				reason: "BOT_NOT_FOUND",
				id: values.botId,
				message: "Bot not found",
			});
		}
		const [chat] = yield* db.insert(dbSchema.chat).values(values).returning();
		yield* recordRelationshipFacts(
			RelationshipFact.ChatCreated({
				chatId: chat.id,
				ownerId: chat.userId,
				botId: chat.botId,
			}),
		);
		return chat;
	});

/** Deletes the chats matching `where` and records the removal of their owner and bot; call it in a `writeRelationships`. */
export const deleteChatsWhere = (where: SQL) =>
	Effect.gen(function* () {
		const db = yield* DB;
		const deleted = yield* db.delete(dbSchema.chat).where(where).returning({
			id: dbSchema.chat.id,
			userId: dbSchema.chat.userId,
			botId: dbSchema.chat.botId,
		});
		yield* recordRelationshipFacts(
			...deleted.map((chat) =>
				RelationshipFact.ChatDeleted({
					chatId: chat.id,
					ownerId: chat.userId,
					botId: chat.botId,
				}),
			),
		);
		return deleted.length;
	});
