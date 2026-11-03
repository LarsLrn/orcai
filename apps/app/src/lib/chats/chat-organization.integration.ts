import { describe, expect, test } from "bun:test";
import type { BotId, ChatId, ChatMessageId, OrganizationId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import {
	awaitLockWaiters,
	createOrganization,
	holdLock,
	reasonOf,
} from "@orcai/testing";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { Procedures } from "@/lib/orpc/implementation/procedures";
import {
	type Actor,
	appIntegration,
	TIMEOUT,
} from "@/lib/testing/app-integration";

const { run, caller, organizationWith, procedureOptions, signIn } =
	appIntegration();

/** An admin and a member of one organisation, the member also in a second one, and their chat procedures. */
const twoOrganizations = async () => {
	const {
		organizationId: home,
		actors: [admin, member],
		zedToken,
	} = await organizationWith([
		"admin",
		"member",
	]);
	const { organization: other } = await run(
		createOrganization({
			members: [
				{
					userId: member.user.id,
					role: "member",
				},
			],
		}),
	);
	const elsewhere = await signIn(other.id, member.user.id);
	const procedures = await run(Procedures);
	const { call, token } = caller(zedToken);
	const options = (actor: Actor) => procedureOptions(actor, token());

	/** A chat of `actor`'s active organisation with one question. */
	const createChat = async (actor: Actor, botId?: BotId) => {
		const { data: chat } = await call(actor, (options) =>
			procedures.chat.create(
				{
					title: "Org chat",
					botId,
				},
				options,
			),
		);
		const messageId = crypto.randomUUID() as ChatMessageId;
		await run(
			Effect.gen(function* () {
				yield* (yield* DB).insert(dbSchema.chatMessage).values({
					id: messageId,
					chatId: chat.id,
					role: "user",
					parts: [
						{
							type: "text",
							text: "Hello?",
						},
					],
					attachments: [],
					metadata: {},
					position: 0,
				});
			}),
		);
		return {
			chat,
			messageId,
		};
	};

	const find = async (actor: Actor, id: ChatId) =>
		(
			await call(actor, (options) =>
				procedures.chat.find(
					{
						id,
					},
					options,
				),
			)
		).data;

	const listed = async (actor: Actor) =>
		(
			await call(actor, (options) =>
				procedures.chat.list(
					{
						pageIndex: 0,
						pageSize: 100,
					},
					options,
				),
			)
		).data.map((chat) => chat.id);

	const history = async (actor: Actor) =>
		(
			await call(actor, (options) =>
				procedures.chat.history(
					{
						pageIndex: 0,
						pageSize: 100,
					},
					options,
				),
			)
		).data;

	const {
		data: { id: blockId },
	} = await call(member, (options) =>
		procedures.block.create(
			{
				type: "behaviour",
				name: "Org block",
				description: null,
				contentJson: null,
				status: "draft",
				config: {
					systemPrompt: "",
				},
			},
			options,
		),
	);

	/** The reasons a turn, a rename, a branch and an attachment of the member's block are refused with. */
	const refusals = async (
		actor: Actor,
		chatId: ChatId,
		messageId: ChatMessageId,
	) => {
		return {
			turn: await reasonOf(
				run(
					procedures.ai.chat(
						{
							chatId,
							message: {
								id: crypto.randomUUID() as ChatMessageId,
								role: "user",
								parts: [
									{
										type: "text",
										text: "Again?",
									},
								],
								attachments: [],
							},
						},
						await options(actor),
					),
				),
			),
			update: await reasonOf(
				run(
					procedures.chat.update(
						{
							id: chatId,
							title: "Renamed",
						},
						await options(actor),
					),
				),
			),
			branch: await reasonOf(
				run(
					procedures.chat.branch(
						{
							chatId,
							messageId,
						},
						await options(actor),
					),
				),
			),
			attach: await reasonOf(
				run(
					procedures.chatBlock.attach(
						{
							chatId,
							blockId,
						},
						await options(actor),
					),
				),
			),
		};
	};

	return {
		home,
		other: other.id as OrganizationId,
		admin,
		member,
		elsewhere,
		procedures,
		options,
		call,
		createChat,
		find,
		listed,
		history,
		refusals,
	};
};

describe("chats belong to an organisation", () => {
	test(
		"a chat is created in the active organisation and listed only there",
		async () => {
			const { home, other, member, elsewhere, createChat, listed, find } =
				await twoOrganizations();
			const { chat: homeChat } = await createChat(member);
			const { chat: otherChat } = await createChat(elsewhere);

			expect(homeChat.organizationId).toBe(home);
			expect(otherChat.organizationId).toBe(other);
			expect(await listed(member)).toEqual([
				homeChat.id,
			]);
			expect(await listed(elsewhere)).toEqual([
				otherChat.id,
			]);
			expect((await find(elsewhere, homeChat.id)).readOnly).toBe(
				"other-organization",
			);
			expect((await find(member, homeChat.id)).readOnly).toBeNull();
		},
		TIMEOUT,
	);

	test(
		"turns, edits, branches and attachments need the chat's organisation active",
		async () => {
			const {
				home,
				member,
				elsewhere,
				createChat,
				refusals,
				call,
				procedures,
			} = await twoOrganizations();
			const { chat, messageId } = await createChat(member);

			expect(await refusals(elsewhere, chat.id, messageId)).toEqual({
				turn: "CHAT_ORGANIZATION_MISMATCH",
				update: "CHAT_ORGANIZATION_MISMATCH",
				branch: "CHAT_ORGANIZATION_MISMATCH",
				attach: "CHAT_ORGANIZATION_MISMATCH",
			});

			const { data: branch } = await call(member, (options) =>
				procedures.chat.branch(
					{
						chatId: chat.id,
						messageId,
					},
					options,
				),
			);
			expect(branch.organizationId).toBe(home);
		},
		TIMEOUT,
	);

	test(
		"after leaving the organisation the chat is history: readable, listed there, and read-only",
		async () => {
			const {
				home,
				admin,
				member,
				elsewhere,
				createChat,
				find,
				history,
				refusals,
				call,
				procedures,
			} = await twoOrganizations();
			const { chat, messageId } = await createChat(member);
			expect(await history(member)).toEqual([]);

			await call(admin, (options) =>
				procedures.organizationMember.delete(
					{
						refs: [
							{
								userId: member.user.id,
							},
						],
					},
					options,
				),
			);

			expect((await find(elsewhere, chat.id)).readOnly).toBe("not-member");
			expect(
				(await history(elsewhere)).map((row) => [
					row.id,
					row.organizationId,
				]),
			).toEqual([
				[
					chat.id,
					home,
				],
			]);
			expect(await refusals(elsewhere, chat.id, messageId)).toEqual({
				turn: "CHAT_ORGANIZATION_MISMATCH",
				update: "CHAT_ORGANIZATION_MISMATCH",
				branch: "CHAT_ORGANIZATION_MISMATCH",
				attach: "CHAT_ORGANIZATION_MISMATCH",
			});
			// The old session still names the left organisation, which no longer admits it.
			expect((await refusals(member, chat.id, messageId)).turn).toBe(
				"ORGANIZATION_MEMBERSHIP_REVOKED",
			);
		},
		TIMEOUT,
	);

	test(
		"a user without any membership still reads and lists their chats",
		async () => {
			const {
				admin,
				member,
				elsewhere,
				other,
				createChat,
				find,
				history,
				call,
				procedures,
				options,
			} = await twoOrganizations();
			const { chat } = await createChat(member);
			await call(admin, (options) =>
				procedures.organizationMember.delete(
					{
						refs: [
							{
								userId: member.user.id,
							},
						],
					},
					options,
				),
			);
			await run(
				Effect.gen(function* () {
					yield* (yield* DB)
						.delete(dbSchema.member)
						.where(eq(dbSchema.member.organizationId, other));
				}),
			);
			const unattached: Actor = {
				...elsewhere,
				session: {
					...elsewhere.session,
					activeOrganizationId: null,
				},
			};

			expect((await find(unattached, chat.id)).readOnly).toBe("not-member");
			expect((await history(unattached)).map((row) => row.id)).toEqual([
				chat.id,
			]);
			expect(
				await reasonOf(
					run(
						procedures.chat.update(
							{
								id: chat.id,
								title: "Renamed",
							},
							await options(unattached),
						),
					),
				),
			).toBe("ACTIVE_ORGANIZATION_REQUIRED");
		},
		TIMEOUT,
	);

	test(
		"deleting the bot leaves its chats read-only with the reason kept",
		async () => {
			const { member, createChat, find, refusals, call, procedures } =
				await twoOrganizations();
			const { data: bot } = await call(member, (options) =>
				procedures.bot.save(
					{
						name: `Org bot ${crypto.randomUUID()}`,
						description: "Integration bot",
						status: "draft",
					},
					options,
				),
			);
			const { chat, messageId } = await createChat(member, bot.id);

			await call(member, (options) =>
				procedures.bot.delete(
					{
						refs: [
							{
								id: bot.id,
							},
						],
					},
					options,
				),
			);

			const deleted = await find(member, chat.id);
			expect(deleted.botId).toBeNull();
			expect(deleted.botDeletedAt).not.toBeNull();
			expect(deleted.readOnly).toBe("bot-deleted");
			expect(await refusals(member, chat.id, messageId)).toEqual({
				turn: "CHAT_BOT_DELETED",
				update: "CHAT_BOT_DELETED",
				branch: "CHAT_BOT_DELETED",
				attach: "CHAT_BOT_DELETED",
			});
		},
		TIMEOUT,
	);

	test(
		"a chat created while its bot is deleted is marked, or refused once the deletion holds the bot",
		async () => {
			const { home, member, createChat, call, procedures, options } =
				await twoOrganizations();
			const saveBot = async () =>
				(
					await call(member, (options) =>
						procedures.bot.save(
							{
								name: `Raced bot ${crypto.randomUUID()}`,
								description: "Integration bot",
								status: "draft",
							},
							options,
						),
					)
				).data.id;
			const deleteBot = async (id: BotId) =>
				call(member, (options) =>
					procedures.bot.delete(
						{
							refs: [
								{
									id,
								},
							],
						},
						options,
					),
				);
			// A creation in flight: the deletion waits for it, then marks its chat.
			const first = await saveBot();
			const inFlight = crypto.randomUUID() as ChatId;
			const releaseCreation = await run(
				holdLock(
					Effect.gen(function* () {
						yield* (yield* DB).insert(dbSchema.chat).values({
							id: inFlight,
							userId: member.user.id,
							botId: first,
							organizationId: home,
						});
					}),
				),
			);
			const firstDeletion = deleteBot(first);
			try {
				await run(awaitLockWaiters('%from "bot"%for update%'));
			} finally {
				await run(releaseCreation);
			}
			await firstDeletion;
			const [marked] = await run(
				Effect.gen(function* () {
					return yield* (yield* DB)
						.select()
						.from(dbSchema.chat)
						.where(eq(dbSchema.chat.id, inFlight));
				}),
			);
			expect(marked.botId).toBeNull();
			expect(marked.botDeletedAt).not.toBeNull();

			// A deletion in flight, held at an existing chat: a new chat waits, then finds no bot.
			const second = await saveBot();
			const { chat: existing } = await createChat(member, second);
			const releaseChat = await run(
				holdLock(
					Effect.gen(function* () {
						yield* (yield* DB)
							.select({
								id: dbSchema.chat.id,
							})
							.from(dbSchema.chat)
							.where(eq(dbSchema.chat.id, existing.id))
							.for("update");
					}),
				),
			);
			try {
				const secondDeletion = deleteBot(second);
				await run(awaitLockWaiters('%"chat"%'));
				const creation = reasonOf(
					run(
						procedures.chat.create(
							{
								title: "Too late",
								botId: second,
							},
							await options(member),
						),
					),
				);
				// Queued behind the deletion, which holds the bot.
				await run(awaitLockWaiters('%from "bot"%for key share%'));
				await run(releaseChat);
				await secondDeletion;
				expect(await creation).toBe("BOT_NOT_FOUND");
			} finally {
				await run(releaseChat);
			}
		},
		TIMEOUT,
	);

	test(
		"leaving locks the chat and joining again unlocks it",
		async () => {
			const {
				home,
				admin,
				member,
				elsewhere,
				createChat,
				find,
				call,
				procedures,
			} = await twoOrganizations();
			const { chat } = await createChat(member);
			await call(admin, (options) =>
				procedures.organizationMember.delete(
					{
						refs: [
							{
								userId: member.user.id,
							},
						],
					},
					options,
				),
			);
			expect((await find(elsewhere, chat.id)).readOnly).toBe("not-member");

			const { data: invitations } = await call(admin, (options) =>
				procedures.organizationInvitation.create(
					{
						role: "member",
						expiresAt: new Date(Date.now() + 86_400_000),
						items: [
							{
								email: member.user.email,
							},
						],
					},
					options,
				),
			);
			await call(elsewhere, (options) =>
				procedures.organizationInvitation.respond(
					{
						id: invitations[0].id,
						response: "accept",
					},
					options,
				),
			);
			const rejoined = await signIn(home, member.user.id);

			expect((await find(rejoined, chat.id)).readOnly).toBeNull();
			const { data: renamed } = await call(rejoined, (options) =>
				procedures.chat.update(
					{
						id: chat.id,
						title: "Back again",
					},
					options,
				),
			);
			expect(renamed.title).toBe("Back again");
		},
		TIMEOUT,
	);

	test(
		"revoking the bot locks its chat and sharing it again unlocks it",
		async () => {
			const { admin, member, createChat, find, refusals, call, procedures } =
				await twoOrganizations();
			const { data: bot } = await call(admin, (options) =>
				procedures.bot.save(
					{
						name: `Shared bot ${crypto.randomUUID()}`,
						description: "Integration bot",
						status: "draft",
					},
					options,
				),
			);
			const grant = async () =>
				call(admin, (options) =>
					procedures.resource.grant(
						{
							resourceType: "bot",
							resourceId: bot.id,
							role: "viewer",
							principals: [
								{
									principalType: "user",
									principalId: member.user.id,
								},
							],
						},
						options,
					),
				);
			await grant();
			const { chat, messageId } = await createChat(member, bot.id);
			expect((await find(member, chat.id)).readOnly).toBeNull();

			await call(admin, (options) =>
				procedures.resource.revoke(
					{
						resourceType: "bot",
						resourceId: bot.id,
						principalType: "user",
						principalId: member.user.id,
					},
					options,
				),
			);
			expect((await find(member, chat.id)).readOnly).toBe("bot-unavailable");
			expect(await refusals(member, chat.id, messageId)).toEqual({
				turn: "CHAT_BOT_UNAVAILABLE",
				update: "CHAT_BOT_UNAVAILABLE",
				branch: "CHAT_BOT_UNAVAILABLE",
				attach: "CHAT_BOT_UNAVAILABLE",
			});

			await grant();
			expect((await find(member, chat.id)).readOnly).toBeNull();
		},
		TIMEOUT,
	);

	test(
		"a locked chat shows its own settings, not the bot's live setup",
		async () => {
			const { admin, member, elsewhere, createChat, find, call, procedures } =
				await twoOrganizations();
			const { data: provider } = await call(admin, (options) =>
				procedures.provider.create(
					{
						name: `Locked ${crypto.randomUUID()}`,
						description: "Serves the locked chat test.",
						kind: "openai-compatible",
						endpoint: "http://127.0.0.1:9/v1",
						apiKey: "key",
						meteringMode: "tokens",
						enabled: true,
					},
					options,
				),
			);
			const { data: model } = await call(admin, (options) =>
				procedures.model.create(
					{
						providerId: provider.id,
						providerModelId: `locked-${crypto.randomUUID()}`,
						name: "Locked model",
						description: "A chat model.",
						isDeprecated: false,
						capabilities: [
							"text",
							"tool-calling",
						],
					},
					options,
				),
			);
			const { data: bot } = await call(admin, (options) =>
				procedures.bot.save(
					{
						name: `Required bot ${crypto.randomUUID()}`,
						description: "Integration bot",
						status: "draft",
					},
					options,
				),
			);
			const grant = async () =>
				call(admin, (options) =>
					procedures.resource.grant(
						{
							resourceType: "bot",
							resourceId: bot.id,
							role: "viewer",
							principals: [
								{
									principalType: "user",
									principalId: member.user.id,
								},
							],
						},
						options,
					),
				);
			const requireModel = async (temperature: number) =>
				call(admin, (options) =>
					procedures.botSetup.save(
						{
							botId: bot.id,
							setup: {
								modelId: model.id,
								strength: "required",
								generation: {
									temperature,
								},
							},
						},
						options,
					),
				);
			await grant();
			await requireModel(0.2);
			const { chat } = await createChat(member, bot.id);
			await requireModel(0.9);
			expect((await find(member, chat.id)).effectiveModel).toMatchObject({
				source: "bot-required",
				generation: {
					temperature: 0.9,
				},
			});

			const seeded = {
				modelId: model.id,
				generation: {
					temperature: 0.2,
				},
				source: "chat",
				botSetup: null,
			};
			await call(admin, (options) =>
				procedures.resource.revoke(
					{
						resourceType: "bot",
						resourceId: bot.id,
						principalType: "user",
						principalId: member.user.id,
					},
					options,
				),
			);
			expect((await find(member, chat.id)).effectiveModel).toMatchObject(
				seeded,
			);

			await grant();
			await call(admin, (options) =>
				procedures.organizationMember.delete(
					{
						refs: [
							{
								userId: member.user.id,
							},
						],
					},
					options,
				),
			);
			expect((await find(elsewhere, chat.id)).effectiveModel).toMatchObject(
				seeded,
			);
		},
		TIMEOUT,
	);
});
