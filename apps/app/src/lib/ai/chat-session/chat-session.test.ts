import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { TransformStream } from "node:stream/web";
import type { ChatId, ChatMessageId } from "@orcai/core";
import type { ContinueChatInput } from "@orcai/schema";
import { ORPCError } from "@orpc/client";
import type { UIMessageChunk } from "ai";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { type ChatPage, type ChatPort, ChatSession } from "./chat-session";

// happy-dom's TransformStream does not mix with the SDK's streams; this file runs on the native one.
const domTransformStream = globalThis.TransformStream;
beforeAll(() => {
	Object.assign(globalThis, {
		TransformStream,
	});
});
afterAll(() => {
	Object.assign(globalThis, {
		TransformStream: domTransformStream,
	});
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

const until = async (done: () => boolean) => {
	while (!done()) await tick();
};

const chatId = "00000000-0000-4000-8000-0000000000c1" as ChatId;

type Part = ChatAgentUIMessage["parts"][number];

const message = (
	id: string,
	role: "user" | "assistant",
	parts: unknown[],
): ChatAgentUIMessage =>
	({
		id: id as ChatMessageId,
		role,
		parts: parts as Part[],
	}) as ChatAgentUIMessage;

const text = (value: string) => ({
	type: "text",
	text: value,
	state: "done",
});

const deleteBot = (
	state: "approval-requested" | "approval-responded",
	approved?: boolean,
) => ({
	type: "tool-deleteBot",
	toolCallId: "delete-1",
	state,
	input: {
		ids: [
			"bot-1",
		],
	},
	approval: {
		id: "approval-1",
		...(approved === undefined
			? {}
			: {
					approved,
				}),
	},
});

const requestUpload = {
	type: "tool-requestUpload",
	toolCallId: "upload-1",
	state: "input-available",
	input: {
		reason: "Needs the style guide",
	},
};

const paused = (...calls: unknown[]) =>
	message("reply-1", "assistant", [
		{
			type: "step-start",
		},
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
		turnEnded: (message) => {
			calls.turnEnded.push(message);
			return Promise.resolve();
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
		let messagesBeforePrepend = 0;

		expect(chat.hasEarlier).toBe(true);
		const [more] = await Promise.all([
			chat.loadEarlier(() => {
				messagesBeforePrepend = chat.chat.messages.length;
			}),
			chat.loadEarlier(),
		]);

		expect(more).toBe(false);
		expect(chat.hasEarlier).toBe(false);
		expect(messagesBeforePrepend).toBe(2);
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

		await empty.sendFirst("Hi");
		expect(empty.sendFirst("Hi")).toBeUndefined();
		expect(
			session(port, {
				messages: [
					message("question-1", "user", [
						text("Earlier"),
					]),
				],
			}).sendFirst("Hi"),
		).toBeUndefined();
		expect(calls.chat).toHaveLength(1);
	});
});
