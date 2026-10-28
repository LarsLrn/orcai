import { describe, expect, test } from "bun:test";
import type { BotId, ChatId, ChatMessageId, OrganizationId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { createOrganization } from "@orcai/testing";
import { eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import { Client } from "pg";
import {
	type Actor,
	authzIntegration,
	TIMEOUT,
} from "@/lib/authz/authz-integration";
import { Procedures } from "@/lib/orpc/implementation/procedures";

const { run, organizationWith, procedureOptions, signIn } = authzIntegration();

const connect = async () => {
	const client = new Client({
		host: process.env.POSTGRES_HOST,
		port: Number(process.env.POSTGRES_PORT),
		user: process.env.POSTGRES_USER,
		password: process.env.POSTGRES_PASSWORD,
		database: process.env.POSTGRES_DB,
	});
	await client.connect();
	return client;
};

/** Waits until `depth` backends queue behind `client`: 1 directly, 2 behind one that does. */
const untilQueuedBehind = async (client: Client, depth: 1 | 2) => {
	const deadline = Date.now() + 20_000;
	const query =
		depth === 1
			? `SELECT count(*)::int AS queued FROM pg_stat_activity
			   WHERE pg_backend_pid() = ANY(pg_blocking_pids(pid))`
			: `SELECT count(*)::int AS queued FROM pg_stat_activity waiter
			   WHERE EXISTS (
			     SELECT 1 FROM pg_stat_activity blocker
			     WHERE pg_backend_pid() = ANY(pg_blocking_pids(blocker.pid))
			       AND blocker.pid = ANY(pg_blocking_pids(waiter.pid))
			   )`;
	while (
		(
			await client.query<{
				queued: number;
			}>(query)
		).rows[0].queued === 0
	) {
		if (Date.now() > deadline)
			throw new Error("Nothing queued behind the lock");
		await new Promise((resolve) => setTimeout(resolve, 25));
	}
};

const reasonOf = (operation: Promise<unknown>) =>
	operation.then(
		() => undefined,
		(error: { reason?: string }) => error.reason,
	);

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
	let token = zedToken;

	const options = (actor: Actor) => procedureOptions(actor, token);
	const call = async <A>(
		operation: Effect.Effect<
			A & {
				meta?: {
					zedToken?: string;
				};
			},
			unknown
		>,
	) => {
		const result = await run(operation);
		token = result.meta?.zedToken ?? token;
		return result;
	};

	/** A chat of `actor`'s active organisation with one question. */
	const createChat = async (actor: Actor, botId?: BotId) => {
		const { data: chat } = await call(
			procedures.chat.create(
				{
					title: "Org chat",
					botId,
				},
				await options(actor),
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
			await call(
				procedures.chat.find(
					{
						id,
					},
					await options(actor),
				),
			)
		).data;

	const listed = async (actor: Actor) =>
		(
			await call(
				procedures.chat.list(
					{
						pageIndex: 0,
						pageSize: 100,
					},
					await options(actor),
				),
			)
		).data.map((chat) => chat.id);

	const history = async (actor: Actor) =>
		(
			await call(
				procedures.chat.history(
					{
						pageIndex: 0,
						pageSize: 100,
					},
					await options(actor),
				),
			)
		).data;

	const {
		data: { id: blockId },
	} = await call(
		procedures.block.create(
			{
				type: "template",
				name: "Org block",
				description: null,
				contentJson: null,
				contentHtml: null,
				status: "draft",
				config: {
					systemPrompt: "",
				},
			},
			await options(member),
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
				options,
			} = await twoOrganizations();
			const { chat, messageId } = await createChat(member);

			expect(await refusals(elsewhere, chat.id, messageId)).toEqual({
				turn: "CHAT_ORGANIZATION_MISMATCH",
				update: "CHAT_ORGANIZATION_MISMATCH",
				branch: "CHAT_ORGANIZATION_MISMATCH",
				attach: "CHAT_ORGANIZATION_MISMATCH",
			});

			const { data: branch } = await call(
				procedures.chat.branch(
					{
						chatId: chat.id,
						messageId,
					},
					await options(member),
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
				options,
			} = await twoOrganizations();
			const { chat, messageId } = await createChat(member);
			expect(await history(member)).toEqual([]);

			await call(
				procedures.organizationMember.delete(
					{
						refs: [
							{
								userId: member.user.id,
							},
						],
					},
					await options(admin),
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
			await call(
				procedures.organizationMember.delete(
					{
						refs: [
							{
								userId: member.user.id,
							},
						],
					},
					await options(admin),
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
			const { member, createChat, find, refusals, call, procedures, options } =
				await twoOrganizations();
			const { data: bot } = await call(
				procedures.bot.save(
					{
						name: `Org bot ${crypto.randomUUID()}`,
						description: "Integration bot",
						status: "draft",
					},
					await options(member),
				),
			);
			const { chat, messageId } = await createChat(member, bot.id);

			await call(
				procedures.bot.delete(
					{
						refs: [
							{
								id: bot.id,
							},
						],
					},
					await options(member),
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
					await call(
						procedures.bot.save(
							{
								name: `Raced bot ${crypto.randomUUID()}`,
								description: "Integration bot",
								status: "draft",
							},
							await options(member),
						),
					)
				).data.id;
			const deleteBot = async (id: BotId) =>
				call(
					procedures.bot.delete(
						{
							refs: [
								{
									id,
								},
							],
						},
						await options(member),
					),
				);
			const client = await connect();
			try {
				// A creation in flight: the deletion waits for it, then marks its chat.
				const first = await saveBot();
				await client.query("BEGIN");
				const {
					rows: [inFlight],
				} = await client.query<{
					id: string;
				}>(
					"INSERT INTO chat (user_id, bot_id, organization_id) VALUES ($1, $2, $3) RETURNING id",
					[
						member.user.id,
						first,
						home,
					],
				);
				const firstDeletion = deleteBot(first);
				await untilQueuedBehind(client, 1);
				await client.query("COMMIT");
				await firstDeletion;
				const {
					rows: [marked],
				} = await client.query<{
					bot_id: string | null;
					bot_deleted_at: Date | null;
				}>("SELECT bot_id, bot_deleted_at FROM chat WHERE id = $1", [
					inFlight.id,
				]);
				expect(marked.bot_id).toBeNull();
				expect(marked.bot_deleted_at).not.toBeNull();

				// A deletion in flight, held at an existing chat: a new chat waits, then finds no bot.
				const second = await saveBot();
				const { chat: existing } = await createChat(member, second);
				await client.query("BEGIN");
				await client.query("SELECT id FROM chat WHERE id = $1 FOR UPDATE", [
					existing.id,
				]);
				const secondDeletion = deleteBot(second);
				await untilQueuedBehind(client, 1);
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
				await untilQueuedBehind(client, 2);
				await client.query("COMMIT");
				await secondDeletion;
				expect(await creation).toBe("BOT_NOT_FOUND");
			} finally {
				await client.query("ROLLBACK").catch(() => undefined);
				await client.end();
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
				options,
			} = await twoOrganizations();
			const { chat } = await createChat(member);
			await call(
				procedures.organizationMember.delete(
					{
						refs: [
							{
								userId: member.user.id,
							},
						],
					},
					await options(admin),
				),
			);
			expect((await find(elsewhere, chat.id)).readOnly).toBe("not-member");

			const { data: invitations } = await call(
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
					await options(admin),
				),
			);
			await call(
				procedures.organizationInvitation.respond(
					{
						id: invitations[0].id,
						response: "accept",
					},
					await options(elsewhere),
				),
			);
			const rejoined = await signIn(home, member.user.id);

			expect((await find(rejoined, chat.id)).readOnly).toBeNull();
			const { data: renamed } = await call(
				procedures.chat.update(
					{
						id: chat.id,
						title: "Back again",
					},
					await options(rejoined),
				),
			);
			expect(renamed.title).toBe("Back again");
		},
		TIMEOUT,
	);

	test(
		"revoking the bot locks its chat and sharing it again unlocks it",
		async () => {
			const {
				admin,
				member,
				createChat,
				find,
				refusals,
				call,
				procedures,
				options,
			} = await twoOrganizations();
			const { data: bot } = await call(
				procedures.bot.save(
					{
						name: `Shared bot ${crypto.randomUUID()}`,
						description: "Integration bot",
						status: "draft",
					},
					await options(admin),
				),
			);
			const grant = async () =>
				call(
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
						await options(admin),
					),
				);
			await grant();
			const { chat, messageId } = await createChat(member, bot.id);
			expect((await find(member, chat.id)).readOnly).toBeNull();

			await call(
				procedures.resource.revoke(
					{
						resourceType: "bot",
						resourceId: bot.id,
						principalType: "user",
						principalId: member.user.id,
					},
					await options(admin),
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
			const {
				admin,
				member,
				elsewhere,
				createChat,
				find,
				call,
				procedures,
				options,
			} = await twoOrganizations();
			const { data: provider } = await call(
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
					await options(admin),
				),
			);
			const { data: model } = await call(
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
					await options(admin),
				),
			);
			const { data: bot } = await call(
				procedures.bot.save(
					{
						name: `Required bot ${crypto.randomUUID()}`,
						description: "Integration bot",
						status: "draft",
					},
					await options(admin),
				),
			);
			const grant = async () =>
				call(
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
						await options(admin),
					),
				);
			const requireModel = async (temperature: number) =>
				call(
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
						await options(admin),
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
			await call(
				procedures.resource.revoke(
					{
						resourceType: "bot",
						resourceId: bot.id,
						principalType: "user",
						principalId: member.user.id,
					},
					await options(admin),
				),
			);
			expect((await find(member, chat.id)).effectiveModel).toMatchObject(
				seeded,
			);

			await grant();
			await call(
				procedures.organizationMember.delete(
					{
						refs: [
							{
								userId: member.user.id,
							},
						],
					},
					await options(admin),
				),
			);
			expect((await find(elsewhere, chat.id)).effectiveModel).toMatchObject(
				seeded,
			);
		},
		TIMEOUT,
	);
});
