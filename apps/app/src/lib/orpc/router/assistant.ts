import { DB, dbSchema } from "@orcai/db";
import { and, count, desc, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { writeRelationships } from "@/lib/authz/relationship-write";
import { insertChat } from "@/lib/chats/chat-lifecycle";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireOrganization } from "@/lib/orpc/middlewares/organization";

/** Assistant conversations are never shared, so the owner column is the whole check. */
const listAssistantConversations = authed.assistant.list
	.use(requireOrganization())
	.effect(function* ({ input, context }) {
		const db = yield* DB;
		const whereClause = and(
			eq(dbSchema.chat.kind, "assistant"),
			eq(
				dbSchema.chat.organizationId,
				context.auth.session.activeOrganizationId,
			),
			eq(dbSchema.chat.userId, context.auth.user.id),
		);

		const [data, [rowCount]] = yield* Effect.all(
			[
				db
					.select()
					.from(dbSchema.chat)
					.where(whereClause)
					.orderBy(desc(dbSchema.chat.updatedAt), desc(dbSchema.chat.id))
					.limit(input.pageSize)
					.offset(input.pageIndex * input.pageSize),
				db
					.select({
						count: count(),
					})
					.from(dbSchema.chat)
					.where(whereClause),
			],
			{
				concurrency: "unbounded",
			},
		);

		return {
			data,
			rowCount: rowCount.count,
		};
	});

const createAssistantConversation = authed.assistant.create
	.use(requireOrganization())
	.effect(function* ({ context }) {
		const { result: chat } = yield* writeRelationships(
			{
				organizationIds: [],
			},
			insertChat({
				kind: "assistant",
				organizationId: context.auth.session.activeOrganizationId,
				userId: context.auth.user.id,
				botId: null,
				config: {},
			}),
		);

		return {
			data: chat,
		};
	});

export const assistantRouter = {
	list: listAssistantConversations,
	create: createAssistantConversation,
};
