import { DB, dbSchema } from "@orcai/db";
import { and, count, desc, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { AuthzService } from "@/lib/effect/services/authz";
import { authed } from "@/lib/orpc/implementation/authed";
import { requireActiveOrganizationMiddleware } from "@/lib/orpc/middlewares/auth";
import { requireOrganizationPermission } from "@/lib/orpc/middlewares/permission";
import { chatRelationships } from "./chat";

/** Assistant conversations are never shared, so the owner column is the whole check. */
const listAssistantConversations = authed.assistant.list
	.use(requireActiveOrganizationMiddleware)
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
	.use(requireActiveOrganizationMiddleware)
	.use(requireOrganizationPermission("read"))
	.effect(function* ({ context }) {
		const db = yield* DB;
		const authz = yield* AuthzService;

		const [chat] = yield* db
			.insert(dbSchema.chat)
			.values({
				kind: "assistant",
				organizationId: context.auth.session.activeOrganizationId,
				userId: context.auth.user.id,
				botId: null,
				config: {},
			})
			.returning();

		yield* authz.applyRelationshipMutations({
			mutations: chatRelationships(chat),
		});

		return {
			data: chat,
		};
	});

export const assistantRouter = {
	list: listAssistantConversations,
	create: createAssistantConversation,
};
