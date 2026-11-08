import { beforeEach, describe, expect, test } from "bun:test";
import type { ChatId, ChatMessageId, UserId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { quota } from "@orcai/quota/testing";
import { S3Live } from "@orcai/s3/server";
import type { ChatMessageAttachment } from "@orcai/schema";
import { createOrganization, integrationRuntime } from "@orcai/testing";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { scriptedFetch } from "../agents/test-provider";
import { resetProcedures } from "../tools/assistant/test-procedures";
import { assetFixtures } from "./test-assets";
import { answerSetup, chatRow, drain, requester, runTurn } from "./test-turn";

const { startTurn } = await import("./turn");
const { ReplyStore } = await import("./reply-store");
const { DrizzleReplyStore } = await import("./drizzle-reply-store");

const runtime = integrationRuntime(S3Live);
const run = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
	runtime.runPromise(effect as Effect.Effect<A, E, never>);
const { newUser, privateAssets } = assetFixtures(run);

/** The stack's DB, SpiceDB and S3 for a turn, with the reply store over that DB. */
const services = async () => {
	const context = await runtime.context();
	const store = Layer.succeed(
		ReplyStore,
		await runtime.runPromise(
			Effect.gen(function* () {
				return yield* ReplyStore;
			}).pipe(Effect.provide(DrizzleReplyStore)),
		),
	);
	return {
		store,
		provide: <A, E, R>(effect: Effect.Effect<A, E, R>) =>
			effect.pipe(Effect.provide(context)),
	};
};

/** Text the estimate counts as about `tokens`, starting with `label`. */
const filler = (label: string, tokens: number) =>
	`${label} ${"x".repeat(tokens * 4)}`;

const TURNS = 40;

/** Turns whose question carries a file: one old, and many recent ones, more than one batch reads. */
const OLD_FILE = 2;
const RECENT_FILES = [
	21,
	24,
	27,
	30,
	32,
	34,
	36,
	37,
	38,
];

/** A plain chat of `turns` stored turns, with files on the old and the recent turns it has; the `filesOnly` turn's question is its file alone. */
const longChat = async (
	owner: UserId,
	turns = TURNS,
	{
		filesOnly,
	}: {
		filesOnly?: number;
	} = {},
) => {
	const files = [
		{
			turn: OLD_FILE,
			title: "Old notes",
			content: filler("Old file", 500),
		},
		...RECENT_FILES.map((turn) => ({
			turn,
			title: `Notes ${turn}`,
			content: filler(`Recent file ${turn}`, 300),
		})),
	].filter(({ turn }) => turn < turns);
	const { assets } =
		files.length === 0
			? {
					assets: [],
				}
			: await privateAssets(owner, files);
	const filed = new Map<number, ChatMessageAttachment>(
		assets.map((asset, index) => [
			files[index].turn,
			{
				assetId: asset.id,
				title: asset.title,
				fileType: "application/pdf",
				size: asset.size,
			},
		]),
	);
	const { chatId, organizationId } = await run(
		Effect.gen(function* () {
			const db = yield* DB;
			const { organization } = yield* createOrganization({
				members: [
					{
						userId: owner,
						role: "member",
					},
				],
			});
			const [chat] = yield* db
				.insert(dbSchema.chat)
				.values({
					title: "A long chat",
					userId: owner,
					config: chatRow().config,
					organizationId: organization.id,
				})
				.returning();
			const messages = Array.from(
				{
					length: turns,
				},
				(_, turn) => {
					const file = filed.get(turn);
					return [
						{
							id: crypto.randomUUID() as ChatMessageId,
							chatId: chat.id,
							position: turn * 2,
							role: "user",
							parts:
								turn === filesOnly
									? []
									: [
											{
												type: "text" as const,
												text: filler(`Question ${turn}`, 200),
											},
										],
							attachments: file
								? [
										file,
									]
								: [],
							metadata: {},
						},
						{
							id: crypto.randomUUID() as ChatMessageId,
							chatId: chat.id,
							position: turn * 2 + 1,
							role: "assistant",
							parts: [
								{
									type: "text" as const,
									text: filler(`Answer ${turn}`, 400),
									state: "done" as const,
								},
							],
							attachments: [],
							metadata: {},
						},
					];
				},
			).flat();
			if (messages.length > 0) {
				yield* db.insert(dbSchema.chatMessage).values(messages);
			}
			return {
				chatId: chat.id as ChatId,
				organizationId: organization.id,
			};
		}),
	);
	return {
		chatId,
		organizationId,
	};
};

beforeEach(() => {
	resetProcedures();
	quota.reset();
	answerSetup({
		providerKind: "anthropic",
		providerModelId: "claude-opus-5-5",
		model: {
			contextWindow: 24_000,
		},
	});
});

type SentMessages = {
	messages: {
		role: string;
		content: {
			type: string;
			text?: string;
		}[];
	}[];
};

/** Asks `text` with a new file of `fileText` on the chat; the provider answers the scripted steps. */
const ask = async ({
	owner,
	chat,
	text,
	fileText,
	steps,
}: {
	owner: UserId;
	chat: Awaited<ReturnType<typeof longChat>>;
	text: string | undefined;
	fileText: string;
	steps: Parameters<ReturnType<typeof scriptedFetch>["script"]>[0];
}) => {
	const {
		assets: [latest],
		zedToken,
	} = await privateAssets(owner, [
		{
			title: "Latest notes",
			content: fileText,
		},
	]);
	const provider = scriptedFetch("anthropic");
	globalThis.fetch = provider.fetch;
	provider.script(steps);
	const { store, provide } = await services();
	await drain(
		await runTurn(
			provide(
				startTurn({
					...requester,
					user: {
						...requester.user,
						id: owner,
					},
					organizationId: chat.organizationId,
					zedToken,
					chatId: chat.chatId,
					message: {
						id: crypto.randomUUID() as ChatMessageId,
						role: "user",
						attachments: [
							{
								assetId: latest.id,
							},
						],
						parts:
							text === undefined
								? []
								: [
										{
											type: "text",
											text,
										},
									],
					},
					stop: undefined,
				}),
			),
			store,
		),
	);
	const stored = await runtime.runPromise(
		Effect.gen(function* () {
			return yield* (yield* ReplyStore).load(chat.chatId);
		}).pipe(Effect.provide(store)),
	);
	return {
		bodies: provider.bodies as SentMessages[],
		reply: stored?.messages.at(-1),
	};
};

/** Each message's role and the first word of each text part. */
const shapeOf = ({ messages }: SentMessages) =>
	messages.map(({ role, content }) => ({
		role,
		text: content
			.flatMap(({ text }) => (text === undefined ? [] : text.split(" ")[0]))
			.join(" | "),
	}));

describe("a turn of a long chat", () => {
	test("sends and summarizes its newest turns with their files, and leaves out the oldest", async () => {
		const owner = await newUser();
		// Our own summary fails, so the turn answers from the trimmed prompt.
		const {
			bodies: [summaryRequest, body],
			reply,
		} = await ask({
			owner,
			chat: await longChat(owner),
			text: "What changed?",
			fileText: filler("Latest file", 300),
			steps: [
				{
					refused: true,
				},
				{
					text: "Done.",
				},
			],
		});

		const texts = shapeOf(body);
		const kept = (texts.length - 1) / 2;
		// The newest whole turns, each question with its reply, then the new question.
		expect(texts).toEqual([
			...Array.from(
				{
					length: kept,
				},
				(_, index) => {
					const turn = TURNS - kept + index;
					return [
						{
							role: "user",
							text: RECENT_FILES.includes(turn)
								? "Question | <attachment"
								: "Question",
						},
						{
							role: "assistant",
							text: "Answer",
						},
					];
				},
			).flat(),
			{
				role: "user",
				text: "What | <attachment",
			},
		]);
		expect(kept).toBeGreaterThan(4);
		expect(kept).toBeLessThan(30);
		const sent = JSON.stringify(body.messages);
		expect(sent).toContain(`Question ${TURNS - kept} `);
		expect(sent).not.toContain(`Question ${TURNS - kept - 1} `);
		expect(sent).toContain("Recent file");
		for (const turn of RECENT_FILES.filter((turn) => turn >= TURNS - kept)) {
			expect(sent).toContain(`Recent file ${turn} `);
		}
		expect(sent).toContain("Latest file");
		expect(sent).not.toContain("Old file");
		// The summary reads the newest turns one request can carry, with their files.
		const summarized = JSON.stringify(summaryRequest.messages);
		expect(summarized).toContain("Recent file");
		expect(summarized).not.toContain("Old file");

		expect(reply?.metadata).toMatchObject({
			historyTrimmed: true,
		});
	});

	test("sends a question of files alone with its file", async () => {
		const owner = await newUser();
		const {
			bodies: [, body],
		} = await ask({
			owner,
			chat: await longChat(owner),
			text: undefined,
			fileText: filler("Latest file", 300),
			steps: [
				{
					refused: true,
				},
				{
					text: "Done.",
				},
			],
		});

		expect(shapeOf(body).at(-1)).toEqual({
			role: "user",
			text: "<attachment",
		});
		expect(JSON.stringify(body.messages.at(-1))).toContain("Latest file");
	});
});

describe("the first turn of a chat", () => {
	test("sends a question of files alone with its file", async () => {
		const owner = await newUser();
		const { bodies } = await ask({
			owner,
			chat: await longChat(owner, 0),
			text: undefined,
			fileText: filler("Latest file", 300),
			steps: [
				{
					text: "Done.",
				},
			],
		});

		expect(bodies.map(shapeOf)).toEqual([
			[
				{
					role: "user",
					text: "<attachment",
				},
			],
		]);
		expect(JSON.stringify(bodies[0].messages)).toContain("Latest file");
	});
});

describe("a later turn", () => {
	test("sends an earlier question of files alone in its place", async () => {
		const owner = await newUser();
		const { bodies } = await ask({
			owner,
			chat: await longChat(owner, 4, {
				filesOnly: OLD_FILE,
			}),
			text: "And now?",
			fileText: filler("Latest file", 100),
			steps: [
				{
					text: "Done.",
				},
			],
		});

		const turn = (question: string) => [
			{
				role: "user",
				text: question,
			},
			{
				role: "assistant",
				text: "Answer",
			},
		];
		expect(bodies.map(shapeOf)).toEqual([
			[
				...turn("Question"),
				...turn("Question"),
				...turn("<attachment"),
				...turn("Question"),
				{
					role: "user",
					text: "And | <attachment",
				},
			],
		]);
		expect(JSON.stringify(bodies[0].messages[4])).toContain("Old file");
	});
});
