import { describe, expect, test } from "bun:test";
import type { ChatId, ChatMessageId, ModelId, ProviderId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import type { ChatConfig, ChatConfigPatch } from "@orcai/schema";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import {
	type Actor,
	authzIntegration,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const { run, organizationWith, procedureOptions, outboxDelivered, readTuples } =
	authzIntegration();

const rejection = (operation: Promise<unknown>) =>
	operation.then(
		() => undefined,
		(error: unknown) => error,
	);

const textMessage = (text: string) => [
	{
		type: "text" as const,
		text,
	},
];

/** Two members of one organisation and the chat procedures they call. */
const members = async () => {
	const {
		actors: [owner, other],
		zedToken,
	} = await organizationWith([
		"member",
		"member",
	]);
	const procedures = await run(Procedures);
	let token = zedToken;

	const createChat = async (
		actor: Actor,
		title: string | null,
		messages: string[] = [],
	) => {
		const { data: chat, meta } = await run(
			procedures.chat.create(
				{
					title,
				},
				await procedureOptions(actor, token),
			),
		);
		token = meta?.zedToken ?? token;
		const ids = await run(
			Effect.gen(function* () {
				if (messages.length === 0) return [];
				const rows = yield* (yield* DB)
					.insert(dbSchema.chatMessage)
					.values(
						messages.map((text, position) => ({
							id: crypto.randomUUID() as ChatMessageId,
							chatId: chat.id,
							role: position % 2 === 0 ? "user" : "assistant",
							parts: textMessage(text),
							attachments: [],
							metadata: {},
							position,
						})),
					)
					.returning({
						id: dbSchema.chatMessage.id,
					});
				return rows.map((row) => row.id);
			}),
		);
		return {
			chatId: chat.id,
			messageIds: ids,
		};
	};

	const call = async <A>(
		actor: Actor,
		procedure: (
			options: Awaited<ReturnType<typeof procedureOptions>>,
		) => Effect.Effect<
			A & {
				meta?: {
					zedToken?: string;
				};
			},
			unknown
		>,
	) => {
		const result = await run(procedure(await procedureOptions(actor, token)));
		token = result.meta?.zedToken ?? token;
		return result;
	};

	const list = async (actor: Actor, search?: string) =>
		(
			await call(actor, (options) =>
				procedures.chat.list(
					{
						pageIndex: 0,
						pageSize: 20,
						filters: {
							search,
						},
					},
					options,
				),
			)
		).data;

	const search = (actor: Actor, term: string) => list(actor, term);

	const pin = (actor: Actor, chatId: ChatId, pinned: boolean) =>
		call(actor, (options) =>
			procedures.chat.pin(
				{
					id: chatId,
					pinned,
				},
				options,
			),
		);

	const remove = (actor: Actor, chatId: ChatId) =>
		call(actor, (options) =>
			procedures.chat.delete(
				{
					refs: [
						{
							id: chatId,
						},
					],
				},
				options,
			),
		);

	const branch = async (
		actor: Actor,
		chatId: ChatId,
		messageId: ChatMessageId,
	) =>
		(
			await call(actor, (options) =>
				procedures.chat.branch(
					{
						chatId,
						messageId,
					},
					options,
				),
			)
		).data;

	const createAssistantConversation = async (actor: Actor, text: string) => {
		const { data: chat } = await call(actor, (options) =>
			procedures.assistant.create({}, options),
		);
		await run(
			Effect.gen(function* () {
				yield* (yield* DB).insert(dbSchema.chatMessage).values({
					id: crypto.randomUUID() as ChatMessageId,
					chatId: chat.id,
					role: "user",
					parts: textMessage(text),
					attachments: [],
					metadata: {},
					position: 0,
				});
			}),
		);
		return chat.id;
	};

	const listMessages = async (
		actor: Actor,
		chatId: ChatId,
		through: ChatMessageId,
	) =>
		run(
			procedures.chatMessage.list(
				{
					chatId,
					through,
					limit: 2,
				},
				await procedureOptions(actor, token),
			),
		);

	return {
		owner,
		other,
		createChat,
		createAssistantConversation,
		list,
		search,
		pin,
		remove,
		branch,
		listMessages,
	};
};

describe("chat search", () => {
	test(
		"finds titles and message text by prefix, titles first, with the matching message",
		async () => {
			const { owner, createChat, search } = await members();
			const titled = await createChat(owner, "Quarterly budget review");
			const mentioned = await createChat(owner, "Planning", [
				"What should we plan?",
				"Start with the budgeting numbers for next year.",
			]);
			await createChat(owner, "Unrelated", [
				"Nothing to see here",
			]);

			const results = await search(owner, "budg");

			expect(results.map((chat) => chat.id)).toEqual([
				titled.chatId,
				mentioned.chatId,
			]);
			expect(results[0].match).toBeNull();
			expect(results[1].match).toEqual({
				messageId: mentioned.messageIds[1],
				snippet: [
					{
						text: "Start with the ",
						highlighted: false,
					},
					{
						text: "budgeting",
						highlighted: true,
					},
					{
						text: " numbers for next year",
						highlighted: false,
					},
				],
			});
		},
		TIMEOUT,
	);

	test(
		"every term must match, and only the last is a prefix",
		async () => {
			const { owner, createChat, search } = await members();
			const both = await createChat(owner, null, [
				"Ferries leave Kiel at noon",
			]);
			await createChat(owner, null, [
				"Ferries leave Oslo at night",
			]);

			expect(
				(await search(owner, "ferries kie")).map((chat) => chat.id),
			).toEqual([
				both.chatId,
			]);
			expect(await search(owner, "ferr kiel")).toEqual([]);
		},
		TIMEOUT,
	);

	test(
		"finds only the caller's own chats",
		async () => {
			const { owner, other, createChat, search } = await members();
			const own = await createChat(owner, null, [
				"Tangerine harvest notes",
			]);
			await createChat(other, "Tangerine", [
				"Tangerine harvest notes",
			]);

			expect((await search(owner, "tangerine")).map((chat) => chat.id)).toEqual(
				[
					own.chatId,
				],
			);
		},
		TIMEOUT,
	);

	test(
		"finds the caller's assistant conversations too",
		async () => {
			const { owner, createAssistantConversation, list, search } =
				await members();
			const conversation = await createAssistantConversation(
				owner,
				"Draft a bot for wombat care",
			);

			expect((await search(owner, "wombat")).map((chat) => chat.id)).toEqual([
				conversation,
			]);
			expect(await list(owner)).toEqual([]);
		},
		TIMEOUT,
	);

	test(
		"follows message edits",
		async () => {
			const { owner, createChat, search } = await members();
			const chat = await createChat(owner, null, [
				"Original wording",
			]);
			await run(
				Effect.gen(function* () {
					yield* (yield* DB)
						.update(dbSchema.chatMessage)
						.set({
							parts: textMessage("Revised phrasing"),
						})
						.where(eq(dbSchema.chatMessage.id, chat.messageIds[0]));
				}),
			);

			expect(await search(owner, "original")).toEqual([]);
			expect((await search(owner, "revised")).map((row) => row.id)).toEqual([
				chat.chatId,
			]);
		},
		TIMEOUT,
	);

	test(
		"opens a chat from the matching message through the newest",
		async () => {
			const { owner, createChat, listMessages } = await members();
			const chat = await createChat(owner, null, [
				"one",
				"two",
				"three",
				"four",
				"five",
			]);

			const page = await listMessages(owner, chat.chatId, chat.messageIds[1]);

			expect(page.data.map((message) => message.id)).toEqual(
				chat.messageIds.slice(1),
			);
			expect(page.hasMore).toBe(true);
		},
		TIMEOUT,
	);
});

describe("chat pins", () => {
	test(
		"a pinned chat leads the list until it is unpinned",
		async () => {
			const { owner, createChat, list, pin } = await members();
			const older = await createChat(owner, "Older");
			const newer = await createChat(owner, "Newer");

			const pinned = await pin(owner, older.chatId, true);
			expect(pinned.data.pinnedAt).toBeInstanceOf(Date);
			expect((await list(owner)).map((chat) => chat.id)).toEqual([
				older.chatId,
				newer.chatId,
			]);

			await pin(owner, older.chatId, false);
			const unpinned = await list(owner);
			expect(unpinned.map((chat) => chat.id)).toEqual([
				newer.chatId,
				older.chatId,
			]);
			expect(unpinned.every((chat) => chat.pinnedAt === null)).toBe(true);
		},
		TIMEOUT,
	);

	test(
		"a branch of a pinned chat starts unpinned",
		async () => {
			const { owner, createChat, pin, branch } = await members();
			const source = await createChat(owner, "Source", [
				"Question",
				"Answer",
			]);
			await pin(owner, source.chatId, true);

			const copy = await branch(owner, source.chatId, source.messageIds[1]);

			expect(copy.pinnedAt).toBeNull();
		},
		TIMEOUT,
	);

	test(
		"only the owner pins, and never an assistant conversation",
		async () => {
			const { owner, other, createChat, createAssistantConversation, pin } =
				await members();
			const chat = await createChat(owner, "Mine");
			const conversation = await createAssistantConversation(owner, "Hello");

			expect(await rejection(pin(other, chat.chatId, true))).toMatchObject({
				reason: "PERMISSION_DENIED",
			});
			expect(await rejection(pin(owner, conversation, true))).toMatchObject({
				reason: "ASSISTANT_CONVERSATION_IMMUTABLE",
			});
		},
		TIMEOUT,
	);
});

describe("chat deletion", () => {
	test(
		"removes the chat's relationships",
		async () => {
			const { owner, createChat, remove } = await members();
			const { chatId } = await createChat(owner, "Gone");
			await outboxDelivered(chatId);
			expect(
				await readTuples({
					resourceType: "chat",
					resourceId: chatId,
				}),
			).toEqual([
				`owner@user:${owner.user.id}`,
			]);

			await remove(owner, chatId);
			await outboxDelivered(chatId);

			expect(
				await readTuples({
					resourceType: "chat",
					resourceId: chatId,
				}),
			).toEqual([]);
		},
		TIMEOUT,
	);
});

describe("a chat's model and provider", () => {
	const withProviders = async () => {
		const {
			actors: [admin, member],
			zedToken,
		} = await organizationWith([
			"admin",
			"member",
		]);
		const procedures = await run(Procedures);
		let token = zedToken;
		const addProvider = async (kind: "openai-compatible" | "tavily") => {
			const { data, meta } = await run(
				procedures.provider.create(
					{
						name: `${kind} ${crypto.randomUUID()}`,
						description: "Created by the chat config test.",
						kind,
						endpoint: "http://127.0.0.1:9/v1",
						apiKey: "key",
						meteringMode: kind === "tavily" ? "requests" : "tokens",
						enabled: true,
					},
					await procedureOptions(admin, token),
				),
			);
			token = meta?.zedToken ?? token;
			return data;
		};
		const addModel = async (providerId: ProviderId) =>
			(
				await run(
					procedures.model.create(
						{
							providerId,
							providerModelId: crypto.randomUUID(),
							name: "Chat model",
							description: "A text model.",
							isDeprecated: false,
							capabilities: [
								"text",
								"tool-calling",
							],
						},
						await procedureOptions(admin, token),
					),
				)
			).data;
		const chat = async () => {
			const { data, meta } = await run(
				procedures.chat.create(
					{
						title: "Config",
					},
					await procedureOptions(member, token),
				),
			);
			token = meta?.zedToken ?? token;
			return data;
		};
		const create = async (config: ChatConfig) =>
			run(
				procedures.chat.create(
					{
						title: "Config",
						config,
					},
					await procedureOptions(member, token),
				),
			);
		const update = async (id: ChatId, config: ChatConfigPatch) =>
			run(
				procedures.chat.update(
					{
						id,
						config,
					},
					await procedureOptions(member, token),
				),
			);

		return {
			addProvider,
			addModel,
			chat,
			create,
			update,
		};
	};

	test(
		"a search provider is refused in a chat's config, a model of its own provider is kept",
		async () => {
			const { addProvider, addModel, chat, create, update } =
				await withProviders();
			const search = await addProvider("tavily");
			const provider = await addProvider("openai-compatible");
			const model = await addModel(provider.id);

			expect(
				await rejection(
					create({
						providerId: search.id,
					}),
				),
			).toMatchObject({
				reason: "PROVIDER_PURPOSE_MISMATCH",
			});
			expect(
				await rejection(
					create({
						providerId: search.id,
						modelId: model.id,
					}),
				),
			).toMatchObject({
				reason: "PROVIDER_PURPOSE_MISMATCH",
			});

			expect(
				await rejection(
					create({
						providerId: provider.id,
						modelId: crypto.randomUUID() as ModelId,
					}),
				),
			).toMatchObject({
				reason: "MODEL_NOT_FOUND",
			});
			const elsewhere = await withProviders();
			const foreignProvider = await elsewhere.addProvider("openai-compatible");
			const foreignModel = await elsewhere.addModel(foreignProvider.id);
			expect(
				await rejection(
					create({
						providerId: provider.id,
						modelId: foreignModel.id,
					}),
				),
			).toMatchObject({
				reason: "MODEL_NOT_FOUND",
			});
			expect(
				await rejection(
					create({
						providerId: foreignProvider.id,
					}),
				),
			).toMatchObject({
				reason: "PROVIDER_NOT_FOUND",
			});

			const created = await create({
				providerId: provider.id,
				modelId: model.id,
			});
			expect(created.data.config).toMatchObject({
				providerId: provider.id,
				modelId: model.id,
			});

			const other = await addProvider("openai-compatible");
			const target = await chat();
			expect(
				await rejection(
					update(target.id, {
						providerId: other.id,
						modelId: model.id,
					}),
				),
			).toMatchObject({
				reason: "MODEL_PROVIDER_MISMATCH",
			});
			expect(
				await rejection(
					update(target.id, {
						providerId: search.id,
					}),
				),
			).toMatchObject({
				reason: "PROVIDER_PURPOSE_MISMATCH",
			});
			const updated = await update(target.id, {
				providerId: provider.id,
				modelId: model.id,
			});
			expect(updated.data.config).toMatchObject({
				providerId: provider.id,
				modelId: model.id,
			});
		},
		TIMEOUT,
	);
});
