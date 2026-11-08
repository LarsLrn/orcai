import { describe, expect, spyOn, test } from "bun:test";
import type { AssetId, BotId, ChatId, ChatMessageId } from "@orcai/core";
import type {
	ContinueChatInput,
	KeepUploadsInput,
	KeptUploads,
	TurnWrite,
} from "@orcai/schema";
import { ORPCError } from "@orpc/client";
import type { UIMessageChunk } from "ai";
import {
	stepStartPart,
	textPart,
	toolPart,
	uiMessage,
} from "@/lib/ai/test-parts";
import type { MessagePart } from "@/lib/ai/turn-view/turn-view";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { type ChatPage, type ChatPort, ChatSession } from "./chat-session";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const until = async (done: () => boolean) => {
	while (!done()) await tick();
};

const chatId = "00000000-0000-4000-8000-0000000000c1" as ChatId;

const message = (
	id: string,
	role: "user" | "assistant",
	parts: MessagePart[],
): ChatAgentUIMessage =>
	uiMessage({
		id,
		role,
		parts,
	});

const text = (value: string) => textPart(value);

const deleteBot = (
	state: "approval-requested" | "approval-responded",
	approved?: boolean,
) =>
	toolPart("deleteBot", state, {
		toolCallId: "delete-1",
		input: {
			ids: [
				"bot-1" as BotId,
			],
		},
		approval:
			approved === undefined
				? {
						id: "approval-1",
					}
				: {
						id: "approval-1",
						approved,
					},
	});

const requestUpload = toolPart("requestUpload", "input-available", {
	toolCallId: "upload-1",
	input: {
		reason: "Needs the style guide",
	},
});

const paused = (...calls: MessagePart[]) =>
	message("reply-1", "assistant", [
		stepStartPart(),
		...calls,
	]);

/** A reply the test streams chunk by chunk. */
const replyStream = () => {
	let controller!: ReadableStreamDefaultController<UIMessageChunk>;
	const stream = new ReadableStream<UIMessageChunk>({
		start: (c) => {
			controller = c;
		},
	});
	return {
		stream,
		push: (...chunks: UIMessageChunk[]) => {
			for (const chunk of chunks) controller.enqueue(chunk);
		},
		close: () => controller.close(),
		fail: (error: Error) => controller.error(error),
	};
};

const reply = (
	id: string,
	answer: string,
	zedToken?: string,
): UIMessageChunk[] => [
	{
		type: "start",
		messageId: id,
		messageMetadata: zedToken
			? {
					zedToken,
				}
			: undefined,
	},
	{
		type: "start-step",
	},
	{
		type: "text-start",
		id: "t",
	},
	{
		type: "text-delta",
		id: "t",
		delta: answer,
	},
	{
		type: "text-end",
		id: "t",
	},
	{
		type: "finish-step",
	},
	{
		type: "finish",
	},
];

const botSaved: TurnWrite = {
	path: "bot.save",
	listBlockIds: [],
};

/** A reply whose `createBot` call wrote, at the turn's zedToken. */
const writingReply = (id: string, zedToken: string): UIMessageChunk[] => [
	{
		type: "start",
		messageId: id,
		messageMetadata: {
			zedToken,
		},
	},
	{
		type: "start-step",
	},
	{
		type: "tool-input-available",
		toolCallId: "create-1",
		toolName: "createBot",
		input: {
			name: "Tutor",
		},
	},
	{
		type: "tool-output-available",
		toolCallId: "create-1",
		output: {
			type: "bot",
			id: "bot-1",
			name: "Tutor",
		},
	},
	{
		type: "message-metadata",
		messageMetadata: {
			writes: [
				botSaved,
			],
		},
	},
	{
		type: "finish-step",
	},
	{
		type: "finish",
	},
];

/** A reply that pauses on `deleteBot`'s approval. */
const pausingReply: UIMessageChunk[] = [
	{
		type: "start",
		messageId: "reply-1",
	},
	{
		type: "start-step",
	},
	{
		type: "tool-input-available",
		toolCallId: "delete-1",
		toolName: "deleteBot",
		input: {
			ids: [
				"bot-1",
			],
		},
	},
	{
		type: "tool-approval-request",
		approvalId: "approval-1",
		toolCallId: "delete-1",
	},
	{
		type: "finish-step",
	},
	{
		type: "finish",
	},
];

/** Refreshes that finish only when the test releases them, in order. */
const slowRefreshes = () => {
	const pending: (() => void)[] = [];
	return {
		pending,
		next: () =>
			new Promise<void>((resolve) => {
				pending.push(resolve);
			}),
	};
};

const streamOf = (chunks: UIMessageChunk[]) =>
	new ReadableStream<UIMessageChunk>({
		start: (controller) => {
			for (const chunk of chunks) controller.enqueue(chunk);
			controller.close();
		},
	});

/** Records every call; each turn plays the next queued reply. */
const fakePort = (
	options: {
		replies?: (() => ReadableStream<UIMessageChunk>)[];
		stored?: (ChatAgentUIMessage | undefined)[];
		pages?: ChatPage[];
		keepUploads?: (input: KeepUploadsInput) => Promise<KeptUploads>;
		recordWrites?: () => Promise<void>;
		turnEnded?: () => Promise<void>;
	} = {},
) => {
	const replies = [
		...(options.replies ?? []),
	];
	const stored = [
		...(options.stored ?? []),
	];
	const pages = [
		...(options.pages ?? []),
	];
	const calls = {
		chat: [] as {
			message: ChatAgentUIMessage;
			zedToken: string | undefined;
		}[],
		continue: [] as ContinueChatInput[],
		find: [] as (string | undefined)[],
		list: [] as {
			before?: number;
			zedToken: string | undefined;
		}[],
		keepUploads: [] as KeepUploadsInput[],
		recordWrites: [] as Parameters<ChatPort["recordWrites"]>[0][],
		turnEnded: [] as ChatAgentUIMessage[],
	};
	const nextReply = () =>
		Promise.resolve().then(() => {
			const next = replies.shift();
			if (!next) throw new Error("No reply queued");
			return next();
		});
	const port: ChatPort = {
		chat: ({ message, zedToken }) => {
			calls.chat.push({
				message,
				zedToken,
			});
			return nextReply();
		},
		continue: (input) => {
			calls.continue.push(input);
			return nextReply();
		},
		find: ({ zedToken }) => {
			calls.find.push(zedToken);
			return Promise.resolve(stored.shift());
		},
		list: ({ before, zedToken }) => {
			calls.list.push({
				before,
				zedToken,
			});
			const page = pages.shift();
			return page
				? Promise.resolve(page)
				: Promise.reject(new Error("No page queued"));
		},
		keepUploads: (input) => {
			calls.keepUploads.push(input);
			return (
				options.keepUploads?.(input) ??
				Promise.resolve({
					assets: [],
				})
			);
		},
		recordWrites: (input) => {
			calls.recordWrites.push(input);
			return options.recordWrites?.() ?? Promise.resolve();
		},
		turnEnded: (message) => {
			calls.turnEnded.push(message);
			return options.turnEnded?.() ?? Promise.resolve();
		},
	};
	return {
		port,
		calls,
	};
};

const session = (
	port: ChatPort,
	page: Partial<ChatPage> = {},
	zedToken: string | undefined = "zed-page",
) =>
	new ChatSession({
		chatId,
		page: {
			messages: [],
			before: undefined,
			hasMore: false,
			...page,
		},
		zedToken,
		port,
	});

const texts = (chat: ChatSession) =>
	chat.chat.messages.map((message) =>
		message.parts.flatMap((part) => (part.type === "text" ? part.text : [])),
	);

describe("ChatSession", () => {
	test("sends a user message at the page's zedToken and the next at the reply's", async () => {
		const { port, calls } = fakePort({
			replies: [
				() => streamOf(reply("reply-1", "Hello", "zed-turn")),
				() => streamOf(reply("reply-2", "Again")),
			],
		});
		const chat = session(port);

		await chat.send({
			text: "Hi",
		});
		expect(chat.phase).toBe("idle");
		expect(texts(chat)).toEqual([
			[
				"Hi",
			],
			[
				"Hello",
			],
		]);
		expect(calls.turnEnded.map((message): string => message.id)).toEqual([
			"reply-1",
		]);
		expect(calls.recordWrites).toEqual([]);

		await chat.send({
			text: "Once more",
		});
		expect(calls.chat.map((call) => call.zedToken)).toEqual([
			"zed-page",
			"zed-turn",
		]);
		expect(calls.chat[1]?.message.parts).toEqual([
			{
				type: "text",
				text: "Once more",
			},
		]);
	});

	test("a message reaches the transcript unless a stop cuts it off while it is prepared", async () => {
		const { port, calls } = fakePort({
			replies: [
				() => streamOf(reply("reply-1", "Hello")),
			],
		});
		const chat = session(port);

		const stopped = chat.send({
			text: "Never mind",
		});
		await Promise.resolve();
		await chat.stop();
		expect(await stopped).toBe(false);
		expect(texts(chat)).toEqual([]);
		expect(calls.chat).toHaveLength(0);

		expect(
			await chat.send({
				text: "Hi",
			}),
		).toBe(true);
		expect(calls.chat).toHaveLength(1);
	});

	test("an opening message stopped while it is prepared may be sent again", async () => {
		const { port, calls } = fakePort({
			replies: [
				() => streamOf(reply("reply-1", "Hello")),
			],
		});
		const chat = session(port);

		const stopped = chat.sendFirst({
			text: "Hi",
		});
		await Promise.resolve();
		await chat.stop();
		expect(await stopped).toBe(false);

		expect(
			await chat.sendFirst({
				text: "Hi",
			}),
		).toBe(true);
		expect(
			chat.sendFirst({
				text: "Hi",
			}),
		).toBeUndefined();
		expect(calls.chat).toHaveLength(1);
	});

	test("reports each phase of a turn", async () => {
		const turn = replyStream();
		const { port } = fakePort({
			replies: [
				() => turn.stream,
			],
		});
		const chat = session(port);
		const sent = chat.send({
			text: "Hi",
		});

		await tick();
		expect(chat.phase).toBe("sending");
		turn.push(...reply("reply-1", "Hello").slice(0, 4));
		await tick();
		expect(chat.phase).toBe("streaming");
		turn.push(...reply("reply-1", "Hello").slice(4));
		turn.close();
		await sent;
		expect(chat.phase).toBe("idle");
	});

	test("a turn whose tools wrote is storing until its writes are recorded", async () => {
		const recorded = Promise.withResolvers<void>();
		const { port, calls } = fakePort({
			replies: [
				() => streamOf(writingReply("reply-1", "zed-turn")),
			],
			recordWrites: () => recorded.promise,
		});
		const chat = session(port);
		const sent = chat.send({
			text: "Create the bot",
		});

		await until(() => calls.recordWrites.length === 1);
		expect(chat.phase).toBe("storing");
		expect(calls.turnEnded).toEqual([]);

		recorded.resolve();
		await sent;
		expect(chat.phase).toBe("idle");
		expect(calls.recordWrites).toEqual([
			{
				chatId,
				messageId: "reply-1" as ChatMessageId,
				zedToken: "zed-turn",
			},
		]);
		expect(calls.turnEnded).toHaveLength(1);
	});

	test("a stopped reply is storing until the server has it", async () => {
		const turn = replyStream();
		const { port, calls } = fakePort({
			replies: [
				() => turn.stream,
			],
			stored: [
				message("reply-1", "assistant", []),
				message("reply-1", "assistant", [
					text("Hel"),
				]),
			],
		});
		const chat = session(port);
		let storing = 0;
		chat.subscribe(() => {
			if (chat.phase === "storing") storing++;
		});
		const sent = chat.send({
			text: "Hi",
		});
		await tick();
		turn.push(...reply("reply-1", "Hel").slice(0, 4));
		await tick();

		const stopped = chat.stop();
		expect(chat.phase).not.toBe("idle");
		await stopped;
		await sent;

		expect(storing).toBe(1);
		expect(calls.find).toHaveLength(2);
		expect(chat.phase).toBe("idle");
		expect(calls.turnEnded).toHaveLength(1);
	});

	test("a stopped reply records the writes only the stored reply lists, and refreshes for them", async () => {
		const turn = replyStream();
		const stored = {
			...message("reply-1", "assistant", [
				text("Saved"),
			]),
			metadata: {
				zedToken: "zed-stored",
				writes: [
					botSaved,
				],
			},
		};
		const { port, calls } = fakePort({
			replies: [
				() => turn.stream,
			],
			stored: [
				stored,
			],
		});
		const chat = session(port);
		const sent = chat.send({
			text: "Save the bot",
		});
		await tick();
		turn.push(...reply("reply-1", "Saved").slice(0, 4));
		await tick();

		await chat.stop();
		await sent;

		expect(calls.recordWrites).toEqual([
			{
				chatId,
				messageId: "reply-1" as ChatMessageId,
				zedToken: "zed-stored",
			},
		]);
		expect(calls.turnEnded.map((ended) => ended.metadata?.writes)).toEqual([
			[
				botSaved,
			],
		]);
	});

	test("a failed turn that left no reply stops storing at once", async () => {
		const { port, calls } = fakePort({
			replies: [
				() => {
					throw new Error("Model unavailable");
				},
			],
			stored: [
				undefined,
			],
		});
		const chat = session(port);

		await chat.send({
			text: "Hi",
		});

		expect(calls.find).toHaveLength(1);
		expect(chat.phase).toBe("error");
		expect(chat.chat.error?.message).toBe("Model unavailable");
	});

	describe("a continuation that ends before its finish shows the reply as stored", () => {
		/** A paused reply that said why it stopped, and the same reply after the server settled its continuation. */
		const cutOffContinuation = () => {
			const before = {
				...paused(deleteBot("approval-requested")),
				metadata: {
					interrupted: true,
					stepLimitReached: true,
				},
			};
			const settled = {
				...paused(deleteBot("approval-responded", true)),
				metadata: {},
			};
			const turn = replyStream();
			const { port, calls } = fakePort({
				replies: [
					() => turn.stream,
				],
				stored: [
					{
						...settled,
						metadata: {
							continuedAt: "2026-11-03T08:00:00.000Z",
						},
					},
					settled,
				],
			});
			const chat = session(port, {
				messages: [
					message("question-1", "user", [
						text("Delete it"),
					]),
					before,
				],
			});
			chat.answers.approve({
				id: "approval-1",
				approved: true,
			});
			return {
				chat,
				calls,
				turn,
			};
		};

		test("when stopped", async () => {
			const { chat, calls, turn } = cutOffContinuation();
			await until(() => calls.continue.length === 1);
			turn.push(...reply("reply-1", "Del").slice(0, 4));
			await until(() => chat.phase === "streaming");

			await chat.stop();

			expect(calls.find).toHaveLength(2);
			expect(chat.chat.lastMessage?.metadata).toEqual({});
		});

		test("when its stream fails", async () => {
			const { chat, calls, turn } = cutOffContinuation();
			await until(() => calls.continue.length === 1);
			turn.push(...reply("reply-1", "Del").slice(0, 4));
			await until(() => chat.phase === "streaming");

			turn.fail(new Error("Connection lost"));
			await until(() => calls.turnEnded.length === 1);

			expect(chat.phase).toBe("error");
			expect(calls.find).toHaveLength(2);
			expect(chat.chat.lastMessage?.metadata).toEqual({});
		});
	});

	test("answering the last approval continues with the step's answers", async () => {
		const { port, calls } = fakePort({
			replies: [
				() => streamOf(reply("reply-1", "Deleted")),
			],
		});
		const chat = session(port, {
			messages: [
				message("question-1", "user", [
					text("Delete it"),
				]),
				paused(deleteBot("approval-requested")),
			],
		});

		chat.answers.approve({
			id: "approval-1",
			approved: true,
		});
		await until(() => calls.turnEnded.length === 1);

		expect(calls.continue).toEqual([
			{
				chatId,
				messageId: "reply-1" as ChatMessageId,
				approvals: [
					{
						approvalId: "approval-1",
						approved: true,
						reason: undefined,
					},
				],
				toolOutputs: [],
				zedToken: undefined,
			},
		]);
	});

	test("a failed refresh after a turn leaves later sends working", async () => {
		let refreshes = 0;
		const { port } = fakePort({
			replies: [
				() => streamOf(reply("reply-1", "Hello")),
				() => streamOf(reply("reply-2", "Again")),
			],
			turnEnded: () =>
				++refreshes === 1
					? Promise.reject(new Error("refresh offline"))
					: Promise.resolve(),
		});
		const chat = session(port);
		const logged = spyOn(console, "error").mockImplementation(() => undefined);

		try {
			expect(
				await chat.send({
					text: "first",
				}),
			).toBe(true);
			expect(
				await chat.send({
					text: "second",
				}),
			).toBe(true);
			expect(logged.mock.calls).toEqual([
				[
					new Error("refresh offline"),
				],
			]);
		} finally {
			logged.mockRestore();
		}

		expect(texts(chat)).toEqual([
			[
				"first",
			],
			[
				"Hello",
			],
			[
				"second",
			],
			[
				"Again",
			],
		]);
		expect(chat.phase).toBe("idle");
	});

	test("stop and the next send wait for the turn's refresh", async () => {
		const refreshed = slowRefreshes();
		const { port, calls } = fakePort({
			replies: [
				() => streamOf(reply("reply-1", "Hello")),
				() => streamOf(reply("reply-2", "Again")),
			],
			turnEnded: refreshed.next,
		});
		const chat = session(port);
		const done: string[] = [];

		const first = chat
			.send({
				text: "first",
			})
			.then(() => done.push("first"));
		await until(() => refreshed.pending.length === 1);
		const stopped = chat.stop().then(() => done.push("stopped"));
		const second = chat.send({
			text: "second",
		});
		await tick();
		expect(done).toEqual([]);
		expect(calls.chat).toHaveLength(1);

		refreshed.pending[0]?.();
		await Promise.all([
			first,
			stopped,
		]);
		await until(() => refreshed.pending.length === 2);
		expect(calls.chat).toHaveLength(2);
		refreshed.pending[1]?.();
		expect(await second).toBe(true);
	});

	test("a step answered while the turn before refreshes continues once the refresh is done", async () => {
		const refreshed = slowRefreshes();
		const { port, calls } = fakePort({
			replies: [
				() => streamOf(pausingReply),
				() => streamOf(reply("reply-1", "Deleted")),
			],
			turnEnded: refreshed.next,
		});
		const chat = session(port);

		const sent = chat.send({
			text: "Delete it",
		});
		await until(() => refreshed.pending.length === 1);
		chat.answers.approve({
			id: "approval-1",
			approved: true,
		});
		await tick();
		expect(calls.continue).toHaveLength(0);

		refreshed.pending[0]?.();
		await sent;
		await until(() => refreshed.pending.length === 2);
		expect(calls.continue).toHaveLength(1);
		refreshed.pending[1]?.();
	});

	test("a failed refresh after a continued step leaves the next send working", async () => {
		let refreshes = 0;
		const { port, calls } = fakePort({
			replies: [
				() => streamOf(reply("reply-1", "Deleted")),
				() => streamOf(reply("reply-2", "Done")),
			],
			turnEnded: () =>
				++refreshes === 1
					? Promise.reject(new Error("refresh offline"))
					: Promise.resolve(),
		});
		const chat = session(port, {
			messages: [
				message("question-1", "user", [
					text("Delete it"),
				]),
				paused(deleteBot("approval-requested")),
			],
		});

		chat.answers.approve({
			id: "approval-1",
			approved: true,
		});
		await until(() => calls.turnEnded.length === 1);

		expect(
			await chat.send({
				text: "Thanks",
			}),
		).toBe(true);
		expect(calls.chat.map(({ message }) => message.parts)).toEqual([
			[
				{
					type: "text",
					text: "Thanks",
				},
			],
		]);
		expect(texts(chat).at(-1)).toEqual([
			"Done",
		]);
	});

	test("a client call's answer carries the zedToken its write returned", async () => {
		const { port, calls } = fakePort({
			replies: [
				() => streamOf(reply("reply-1", "Thanks")),
				() => streamOf(reply("reply-2", "Sure")),
			],
		});
		const chat = session(port, {
			messages: [
				paused(requestUpload),
			],
		});

		chat.answers.output({
			tool: "requestUpload",
			toolCallId: "upload-1",
			output: {
				status: "cancelled",
			},
			zedToken: "zed-upload",
		});
		await until(() => calls.turnEnded.length === 1);
		await chat.send({
			text: "Next",
		});

		expect(calls.continue).toMatchObject([
			{
				toolOutputs: [
					{
						toolCallId: "upload-1",
						output: {
							status: "cancelled",
						},
					},
				],
				zedToken: "zed-upload",
			},
		]);
		expect(calls.chat.map((call) => call.zedToken)).toEqual([
			"zed-upload",
		]);
	});

	test("ignores answers to calls the paused step does not wait on", async () => {
		const { port, calls } = fakePort();
		const chat = session(port, {
			messages: [
				paused(deleteBot("approval-requested")),
			],
		});

		chat.answers.approve({
			id: "approval-other",
			approved: true,
		});
		chat.answers.output({
			tool: "requestUpload",
			toolCallId: "upload-1",
			output: {
				status: "cancelled",
			},
		});
		await tick();

		expect(calls.continue).toEqual([]);
		expect(chat.chat.messages.at(-1)?.parts[1]).toMatchObject({
			state: "approval-requested",
		});
	});

	test("keeps a waiting upload's files with the reply, one write at a time", async () => {
		const apa = {
			id: "00000000-0000-4000-8000-000000000001" as AssetId,
			title: "APA 7.pdf",
		};
		const { promise: firstWrite, resolve: release } =
			Promise.withResolvers<KeptUploads>();
		const { port, calls } = fakePort({
			keepUploads: (input) =>
				calls.keepUploads.length === 1
					? firstWrite
					: Promise.resolve({
							assets: [
								apa,
							],
							zedToken: input.zedToken,
						}),
		});
		const chat = session(port, {
			messages: [
				{
					...paused(requestUpload),
					metadata: {
						uploads: {
							"upload-1": {
								assets: [
									apa,
								],
							},
						},
					},
				},
			],
		});
		expect(chat.answers.uploads("upload-1")?.assets).toEqual([
			apa,
		]);

		const first = chat.answers.keepUploads({
			toolCallId: "upload-1",
			assetIds: [],
			zedToken: undefined,
		});
		const second = chat.answers.keepUploads({
			toolCallId: "upload-1",
			assetIds: [
				apa.id,
			],
			zedToken: "zed-upload",
		});
		await tick();
		expect(calls.keepUploads).toHaveLength(1);

		release({
			assets: [],
		});
		await first;
		expect(await second).toEqual({
			assets: [
				apa,
			],
			zedToken: "zed-upload",
		});
		expect(calls.keepUploads).toEqual([
			{
				chatId,
				messageId: "reply-1" as ChatMessageId,
				toolCallId: "upload-1",
				assetIds: [],
				zedToken: undefined,
			},
			{
				chatId,
				messageId: "reply-1" as ChatMessageId,
				toolCallId: "upload-1",
				assetIds: [
					apa.id,
				],
				zedToken: "zed-upload",
			},
		]);
		expect(chat.answers.uploads("upload-1")).toEqual({
			assets: [
				apa,
			],
			zedToken: "zed-upload",
		});
	});

	test("a failed write rejects and the next one still goes out", async () => {
		const { port, calls } = fakePort({
			keepUploads: () =>
				calls.keepUploads.length === 1
					? Promise.reject(new Error("offline"))
					: Promise.resolve({
							assets: [],
						}),
		});
		const chat = session(port, {
			messages: [
				paused(requestUpload),
			],
		});
		const keep = () =>
			chat.answers.keepUploads({
				toolCallId: "upload-1",
				assetIds: [],
				zedToken: undefined,
			});

		expect(await keep().catch((error: Error) => error.message)).toBe("offline");
		expect(await keep()).toEqual({
			assets: [],
		});
		expect(calls.keepUploads).toHaveLength(2);
	});

	test("keeps uploads only for a call the paused step waits on", async () => {
		const { port, calls } = fakePort();
		const chat = session(port, {
			messages: [
				paused(deleteBot("approval-requested")),
			],
		});

		await expect(
			chat.answers.keepUploads({
				toolCallId: "upload-1",
				assetIds: [],
				zedToken: undefined,
			}),
		).rejects.toThrow();

		expect(calls.keepUploads).toEqual([]);
		expect(chat.answers.uploads("upload-1")).toBeUndefined();
	});

	test("reloads the newest page when kept uploads find the turn moved on", async () => {
		const { port, calls } = fakePort({
			keepUploads: () =>
				Promise.reject(
					new ORPCError("CONFLICT", {
						data: {
							reason: "CHAT_TURN_NOT_AWAITING",
						},
					}),
				),
			pages: [
				{
					messages: [
						message("reply-1", "assistant", [
							text("Answered in another tab"),
						]),
					],
					before: 1,
					hasMore: false,
				},
			],
		});
		const chat = session(port, {
			messages: [
				paused(requestUpload),
			],
		});

		await chat.answers
			.keepUploads({
				toolCallId: "upload-1",
				assetIds: [],
				zedToken: undefined,
			})
			.catch(() => undefined);
		await until(() => calls.list.length === 1);
		await tick();

		expect(texts(chat)).toEqual([
			[
				"Answered in another tab",
			],
		]);
	});

	test("continues a step answered before the page loaded, and nothing else", async () => {
		const { port, calls } = fakePort({
			replies: [
				() => streamOf(reply("reply-1", "Deleted")),
			],
		});
		const unanswered = session(port, {
			messages: [
				paused(deleteBot("approval-requested")),
			],
		});
		await unanswered.answers.continue();
		expect(calls.continue).toEqual([]);

		const answered = session(port, {
			messages: [
				paused(deleteBot("approval-responded", false)),
			],
		});
		await answered.answers.continue();
		expect(calls.continue).toMatchObject([
			{
				approvals: [
					{
						approvalId: "approval-1",
						approved: false,
					},
				],
			},
		]);
	});

	test("reloads the newest page when the server's turn moved on", async () => {
		const { port, calls } = fakePort({
			replies: [
				() => {
					throw new ORPCError("CONFLICT", {
						data: {
							reason: "CHAT_TURN_NOT_AWAITING",
						},
					});
				},
			],
			stored: [
				message("reply-1", "assistant", [
					text("Answered in another tab"),
				]),
			],
			pages: [
				{
					messages: [
						message("reply-1", "assistant", [
							text("Answered in another tab"),
						]),
					],
					before: 1,
					hasMore: false,
				},
			],
		});
		const chat = session(port, {
			messages: [
				paused(deleteBot("approval-responded", true)),
			],
		});

		await chat.answers.continue();
		await tick();

		expect(calls.list).toEqual([
			{
				before: undefined,
				zedToken: "zed-page",
			},
		]);
		expect(texts(chat)).toEqual([
			[
				"Answered in another tab",
			],
		]);
		expect(chat.wasLoaded("reply-1")).toBe(true);
	});

	test("prepends older pages through the cursor until none remain", async () => {
		const { port, calls } = fakePort({
			pages: [
				{
					messages: [
						message("question-1", "user", [
							text("First"),
						]),
						message("reply-1", "assistant", [
							text("One"),
						]),
					],
					before: 1,
					hasMore: false,
				},
			],
		});
		const chat = session(port, {
			messages: [
				message("reply-1", "assistant", [
					text("One"),
				]),
				message("question-2", "user", [
					text("Second"),
				]),
			],
			before: 2,
			hasMore: true,
		});

		expect(chat.hasEarlier).toBe(true);
		const [more] = await Promise.all([
			chat.loadEarlier(),
			chat.loadEarlier(),
		]);

		expect(more).toBe(false);
		expect(chat.hasEarlier).toBe(false);
		expect(calls.list).toEqual([
			{
				before: 2,
				zedToken: "zed-page",
			},
		]);
		expect(texts(chat)).toEqual([
			[
				"First",
			],
			[
				"One",
			],
			[
				"Second",
			],
		]);
		expect(await chat.loadEarlier()).toBe(false);
		expect(calls.list).toHaveLength(1);
	});

	test("only messages from the server count as loaded", async () => {
		const { port } = fakePort({
			replies: [
				() => streamOf(reply("reply-2", "Hello")),
			],
		});
		const chat = session(port, {
			messages: [
				message("reply-1", "assistant", [
					text("Earlier"),
				]),
			],
		});

		await chat.send({
			text: "Hi",
		});

		expect(chat.chat.messages.map((m) => chat.wasLoaded(m.id))).toEqual([
			true,
			false,
			false,
		]);
	});

	test("sends a chat's opening message once, and only into an empty chat", async () => {
		const { port, calls } = fakePort({
			replies: [
				() => streamOf(reply("reply-1", "Hello")),
			],
		});
		const empty = session(port);

		await empty.sendFirst({
			text: "Hi",
		});
		expect(
			empty.sendFirst({
				text: "Hi",
			}),
		).toBeUndefined();
		expect(
			session(port, {
				messages: [
					message("question-1", "user", [
						text("Earlier"),
					]),
				],
			}).sendFirst({
				text: "Hi",
			}),
		).toBeUndefined();
		expect(calls.chat).toHaveLength(1);
	});

	test("takes over the attachments the server stored with the question", async () => {
		const attached = {
			assetId: "00000000-0000-4000-8000-0000000000a1" as AssetId,
			title: "Thesis.pdf",
			fileType: "application/pdf",
			size: 4096,
		};
		const { port, calls } = fakePort({
			replies: [
				() => streamOf(reply("reply-1", "Hello")),
			],
			stored: [
				{
					...message("stored", "user", []),
					attachments: [
						{
							...attached,
							truncated: true,
						},
					],
				},
			],
		});
		const chat = session(port);

		await chat.send({
			text: "Summarise it",
			metadata: {
				attachments: [
					attached,
				],
			},
		});

		const [question] = chat.chat.messages;
		expect(question?.attachments).toEqual([
			{
				...attached,
				truncated: true,
			},
		]);
		expect(calls.find).toHaveLength(1);
	});
});
