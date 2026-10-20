import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	ReadableStream,
	TextDecoderStream,
	TextEncoderStream,
	TransformStream,
	WritableStream,
} from "node:stream/web";
import { isDeepStrictEqual } from "node:util";
import { createProviderLanguageModel, providerToolLoading } from "@orcai/ai";
import type { ProviderKind } from "@orcai/core";
import type { DatabaseBlock } from "@orcai/schema";
import {
	type Agent,
	createAgentUIStream,
	getToolName,
	type InferAgentUIMessage,
	isToolUIPart,
	simulateStreamingMiddleware,
	type ToolSet,
	type UIMessage,
	wrapLanguageModel,
} from "ai";
import * as Effect from "effect/Effect";
import type { ResolvedFeature } from "@/lib/ai/features/resolve-features";
import type { ORPCContext } from "@/lib/orpc/implementation/os";
import { answers, resetProcedures } from "../tools/assistant/test-procedures";
import {
	type Body,
	memberCapabilities,
	scriptedFetch,
	type ToolCall,
} from "./test-provider";

const { GEN_UI_TOOL_NAMES } = await import("@/components/chat/gen-ui/catalog");
const { createAssistantAgent } = await import("./assistant-agent");
const { createChatAgent } = await import("./chat-agent");
const { featureCatalog } = await import("@/lib/ai/features/catalog");
const { applyTurnDecisions } = await import(
	"@/lib/ai/utils/apply-turn-decisions"
);
const { closeInvalidToolParts } = await import(
	"@/lib/ai/utils/close-invalid-tool-parts"
);
const { closeLastReply } = await import(
	"@/lib/ai/utils/close-pending-tool-parts"
);
const { streamErrorText } = await import("@/lib/ai/utils/stream-error-text");
const { loadedToolGroupsOf } = await import(
	"../tools/assistant/core/load-tools"
);
const { isPlanApproved } = await import(
	"../tools/assistant/plan/plan-approval"
);
const { createAssistantTurn } = await import("../tools/assistant/turn-state");

// happy-dom's stream globals do not mix with the SDK's; this file runs on the native ones.
const nativeStreams = {
	ReadableStream,
	WritableStream,
	TransformStream,
	TextDecoderStream,
	TextEncoderStream,
};
const domStreams = Object.fromEntries(
	Object.keys(nativeStreams).map((name) => [
		name,
		globalThis[name as keyof typeof nativeStreams],
	]),
);
beforeAll(() => {
	Object.assign(globalThis, nativeStreams);
});
afterAll(() => {
	Object.assign(globalThis, domStreams);
	resetProcedures();
});

// Each request must start with the previous one unchanged, but for the named exceptions: signed reasoning and cached prefixes are bound to it.

/** A model on the kind's real provider, answering with scripted steps. */
const scriptedModel = (kind: ProviderKind, modelId: string) => {
	const { fetch, bodies, script } = scriptedFetch(kind);

	return {
		// Streams each JSON response, since the provider's stream parsers need native streams.
		model: wrapLanguageModel({
			model: createProviderLanguageModel(
				kind,
				{
					apiKey: "key",
					endpoint: kind === "openai-compatible" ? "https://llm.test/v1" : null,
					fetch,
				},
				modelId,
			),
			middleware: simulateStreamingMiddleware(),
		}),
		bodies,
		script,
	};
};

const context = {
	secureCookies: false,
} as ORPCContext;

const telemetryIds = (modelId: string) => ({
	organizationId: "org",
	chatId: "chat",
	providerId: "provider",
	modelId,
});

type TurnAgent<Tools extends ToolSet> = Agent<
	{
		maxSteps: number;
	},
	Tools
>;

/**
 * Runs a conversation as the chat routes do: each request rebuilds the agent
 * over the stored rows, a new message closes the last reply's pending calls,
 * a continuation applies the user's decisions to the paused reply, and each
 * reply is stored as the UI stream ends.
 */
const conversation = <Tools extends ToolSet>(
	agentFor: (history: UIMessage[]) => TurnAgent<Tools>,
) => {
	let rows: UIMessage[] = [];
	let messageCount = 0;

	const stream = async (
		agent: TurnAgent<Tools>,
		messages: UIMessage[],
		replyId: string,
	) => {
		let reply: UIMessage | undefined;
		const chunks = await createAgentUIStream({
			agent,
			uiMessages: messages,
			options: {
				maxSteps: 20,
			},
			originalMessages: messages as InferAgentUIMessage<TurnAgent<Tools>>[],
			generateMessageId: () => replyId,
			onError: streamErrorText,
			onEnd: ({ responseMessage }) => {
				reply = responseMessage;
			},
		});
		for await (const _ of chunks) {
			// Drains the stream, which runs the agent.
		}
		if (!reply) {
			throw new Error("the stream ended without a reply");
		}
		return reply;
	};

	return {
		rows: () => rows,
		send: async (text: string) => {
			const agent = agentFor(rows);
			const { closedHistory } = closeLastReply(rows, agent.tools);
			const user: UIMessage = {
				id: `message-${++messageCount}`,
				role: "user",
				parts: [
					{
						type: "text",
						text,
					},
				],
			};
			const replyId = `message-${++messageCount}`;
			const messages = await closeInvalidToolParts(
				[
					...closedHistory,
					user,
				],
				agent.tools,
			);
			const reply = await stream(agent, messages, replyId);
			rows = [
				...closedHistory,
				user,
				{
					...reply,
					id: replyId,
				},
			];
		},
		/** Answers every approval the paused reply waits for. */
		decide: async (approved: boolean) => {
			const last = rows.at(-1);
			if (!last) {
				throw new Error("nothing to continue");
			}
			const applied = applyTurnDecisions({
				messageId: last.id,
				lastMessage: last,
				decisions: last.parts.flatMap((part) =>
					isToolUIPart(part) && part.state === "approval-requested"
						? [
								{
									approvalId: part.approval.id,
									approved,
								},
							]
						: [],
				),
				toolOutputs: [],
				now: new Date(),
			});
			if (!applied.ok) {
				throw new Error(applied.message);
			}
			const history = [
				...rows.slice(0, -1),
				{
					...last,
					parts: applied.parts,
				},
			];
			const agent = agentFor(history);
			const reply = await stream(
				agent,
				await closeInvalidToolParts(history, agent.tools),
				last.id,
			);
			rows = [
				...rows.slice(0, -1),
				{
					...reply,
					id: last.id,
				},
			];
		},
	};
};

/* A request as a provider-independent sequence of content blocks. */

type BlockKind = "text" | "reasoning" | "tool-call" | "tool-result" | "other";

type Block = {
	role: string;
	kind: BlockKind;
	toolCallId?: string;
	toolName?: string;
	content: unknown;
};

type ModelRequest = {
	system: unknown;
	tools: unknown[];
	blocks: Block[];
};

type AnthropicBlock = {
	type: string;
	id?: string;
	name?: string;
	tool_use_id?: string;
};

const ANTHROPIC_KINDS: Record<string, BlockKind> = {
	text: "text",
	thinking: "reasoning",
	redacted_thinking: "reasoning",
	tool_use: "tool-call",
	tool_result: "tool-result",
};

const namedResults = (blocks: Block[]) => {
	const names = new Map(
		blocks.flatMap((block) =>
			block.kind === "tool-call" && block.toolCallId
				? [
						[
							block.toolCallId,
							block.toolName,
						] as const,
					]
				: [],
		),
	);
	return blocks.map((block) =>
		block.kind === "tool-result" && block.toolCallId
			? {
					...block,
					toolName: names.get(block.toolCallId),
				}
			: block,
	);
};

const fromAnthropic = (body: Body): ModelRequest => ({
	system: body.system,
	tools: (body.tools as unknown[] | undefined) ?? [],
	blocks: namedResults(
		(
			body.messages as {
				role: string;
				content: string | AnthropicBlock[];
			}[]
		).flatMap(({ role, content }) =>
			(typeof content === "string"
				? [
						{
							type: "text",
							text: content,
						} as AnthropicBlock,
					]
				: content
			).map((block) => ({
				role,
				kind: ANTHROPIC_KINDS[block.type] ?? "other",
				toolCallId: block.type === "tool_use" ? block.id : block.tool_use_id,
				toolName: block.name,
				content: block,
			})),
		),
	),
});

type OpenAIMessage = {
	role: string;
	content?: unknown;
	reasoning_content?: string;
	tool_call_id?: string;
	tool_calls?: {
		id: string;
		function: {
			name: string;
		};
	}[];
};

const fromOpenAI = (body: Body): ModelRequest => {
	const messages = body.messages as OpenAIMessage[];

	return {
		system: messages.filter((message) => message.role === "system"),
		tools: (body.tools as unknown[] | undefined) ?? [],
		blocks: namedResults(
			messages.flatMap((message): Block[] => {
				const { role } = message;
				if (role === "system") {
					return [];
				}
				if (role === "tool") {
					return [
						{
							role,
							kind: "tool-result",
							toolCallId: message.tool_call_id,
							content: message,
						},
					];
				}
				if (role !== "assistant") {
					return [
						{
							role,
							kind: "text",
							content: message.content,
						},
					];
				}
				return [
					...(message.reasoning_content
						? [
								{
									role,
									kind: "reasoning" as const,
									content: message.reasoning_content,
								},
							]
						: []),
					...(message.content
						? [
								{
									role,
									kind: "text" as const,
									content: message.content,
								},
							]
						: []),
					...(message.tool_calls ?? []).map((call) => ({
						role,
						kind: "tool-call" as const,
						toolCallId: call.id,
						toolName: call.function.name,
						content: call,
					})),
				];
			}),
		),
	};
};

const toModelRequest = (kind: ProviderKind, body: Body) =>
	kind === "anthropic" ? fromAnthropic(body) : fromOpenAI(body);

/* The rewrites allowed on purpose. */

/**
 * Where a rewrite may reach: the blocks before a boundary, found in the next
 * request as its latest marker and in the previous one as the same marker by
 * count, or past its end when that marker is new.
 */
const boundaries = (
	previous: Block[],
	next: Block[],
	isMarker: (block: Block) => boolean,
) => {
	const positions = (blocks: Block[]) =>
		blocks.flatMap((block, index) =>
			isMarker(block)
				? [
						index,
					]
				: [],
		);
	const nextMarkers = positions(next);
	const count = nextMarkers.length;

	return {
		previous:
			count === 0 ? 0 : (positions(previous)[count - 1] ?? previous.length),
		next: count === 0 ? 0 : (nextMarkers[count - 1] ?? 0),
		hasNewMarker: count > positions(previous).length,
	};
};

const isUserMessage = (block: Block) =>
	block.role === "user" && block.kind !== "tool-result";

const TOOL_LIST_CHANGING_TOOLS = new Set([
	"loadTools",
	"updatePlan",
]);

type Exception = {
	name: string;
	/** Marks the end of the blocks the rewrite may reach. */
	marker: (block: Block) => boolean;
	/** What is left to compare of a block it may reach, given the later request. */
	compared: (block: Block, next: ModelRequest) => Block | undefined;
	/** Whether the tool list may change once a new marker appears. */
	changesTools?: boolean;
};

const FINISHED_TURN_REASONING: Exception = {
	name: "reasoning from finished turns is dropped",
	marker: isUserMessage,
	compared: (block) => (block.kind === "reasoning" ? undefined : block),
};

/** Only results stored as successful are summarised; errors and denials stay. */
const finishedTurnOutputs = (summarised: ReadonlySet<string>): Exception => ({
	name: "tool outputs of finished turns are summarised",
	marker: isUserMessage,
	compared: (block) =>
		block.kind === "tool-result" && summarised.has(block.toolCallId ?? "")
			? {
					...block,
					content: "summarised",
				}
			: block,
});

const FINISHED_TURN_TOOL_CALLS: Exception = {
	name: "tool calls of finished turns before the latest step that called tools are dropped",
	marker: isUserMessage,
	compared: (block, next) =>
		(block.kind === "tool-call" || block.kind === "tool-result") &&
		!next.blocks.some((kept) => kept.toolCallId === block.toolCallId)
			? undefined
			: block,
};

/** Only a load or plan approval that ran changes the list. */
const toolListChange = (ran: ReadonlySet<string>): Exception => ({
	name: "loading tools or approving a plan changes the tool list and drops the turn's reasoning before it",
	marker: (block) =>
		block.kind === "tool-result" &&
		TOOL_LIST_CHANGING_TOOLS.has(block.toolName ?? "") &&
		ran.has(block.toolCallId ?? ""),
	compared: (block) => (block.kind === "reasoning" ? undefined : block),
	changesTools: true,
});

type Rewrite = {
	request: number;
	/** The rewritten part, or the position of the first rewritten block in the previous request. */
	at: string | number;
	sent: unknown;
	now: unknown;
};

/** The first rewrite of `previous` in `next` that no exception allows. */
const firstRewrite = (
	previous: ModelRequest,
	next: ModelRequest,
	exceptions: Exception[],
): Omit<Rewrite, "request"> | undefined => {
	type Positioned = {
		position: number;
		block: Block;
	};
	const positioned = (blocks: Block[]) =>
		blocks.map((block, position) => ({
			position,
			block,
		}));
	let [sent, now] = [
		positioned(previous.blocks),
		positioned(next.blocks),
	];
	let toolsMayChange = false;
	for (const exception of exceptions) {
		const boundary = boundaries(
			sent.map(({ block }) => block),
			now.map(({ block }) => block),
			exception.marker,
		);
		const keep = (blocks: Positioned[], until: number) =>
			blocks.flatMap(({ position, block }, index) => {
				const kept = index < until ? exception.compared(block, next) : block;
				return kept
					? [
							{
								position,
								block: kept,
							},
						]
					: [];
			});
		[sent, now] = [
			keep(sent, boundary.previous),
			keep(now, boundary.next),
		];
		toolsMayChange ||= exception.changesTools === true && boundary.hasNewMarker;
	}

	if (!isDeepStrictEqual(previous.system, next.system)) {
		return {
			at: "system",
			sent: previous.system,
			now: next.system,
		};
	}
	if (!toolsMayChange && !isDeepStrictEqual(previous.tools, next.tools)) {
		return {
			at: "tools",
			sent: previous.tools,
			now: next.tools,
		};
	}
	const index = sent.findIndex(
		({ block }, index) => !isDeepStrictEqual(block, now[index]?.block),
	);
	const rewritten = sent[index];
	return rewritten
		? {
				at: rewritten.position,
				sent: rewritten.block,
				now: now[index]?.block ?? "missing",
			}
		: undefined;
};

/** Every request pair's first rewrite that no exception allows. */
const rewrites = (requests: ModelRequest[], exceptions: Exception[]) =>
	requests.slice(1).flatMap((next, index): Rewrite[] => {
		const previous = requests[index];
		const rewrite = previous && firstRewrite(previous, next, exceptions);
		return rewrite
			? [
					{
						request: index + 1,
						...rewrite,
					},
				]
			: [];
	});

/* The conversations. */

const knowledgeBase = {
	id: crypto.randomUUID(),
	type: "database",
	name: "Papers",
	config: {},
} as DatabaseBlock;

/** Searches a block the knowledge base does not hold, which finds nothing without a database. */
const search = (query?: string): ToolCall => ({
	name: "searchKnowledgeBase",
	input: {
		...(query
			? {
					query,
				}
			: {}),
		blockId: crypto.randomUUID(),
	},
});

const genUiFeature: ResolvedFeature = {
	id: "generativeUi",
	entry: featureCatalog.generativeUi,
	settings: {},
};

const checklist = {
	items: [
		{
			label: "Scope",
			status: "met",
		},
	],
};

/** A chat whose turns search over several steps, one search failing, and show a checklist. */
const chatConversation = async (kind: ProviderKind, modelId: string) => {
	const { model, bodies, script } = scriptedModel(kind, modelId);
	const chat = conversation(() =>
		createChatAgent({
			model,
			providerKind: kind,
			systemPrompt: "You help.",
			databaseBlocks: [
				knowledgeBase,
			],
			features: [
				genUiFeature,
			],
			callSettings: {},
			telemetryIds: telemetryIds(modelId),
			context,
		}),
	);

	script([
		{
			reasoning: "Search the first term.",
			calls: [
				search("alpha"),
			],
		},
		{
			reasoning: "Now the second.",
			text: "One more.",
			calls: [
				search(),
			],
		},
		{
			reasoning: "Show them.",
			calls: [
				{
					name: "showChecklist",
					input: checklist,
				},
			],
		},
		{
			reasoning: "Done.",
			text: "Nothing found.",
		},
	]);
	await chat.send("What are alpha and beta?");

	script([
		{
			reasoning: "Search gamma.",
			calls: [
				search("gamma"),
			],
		},
		{
			text: "Nothing on gamma either.",
		},
	]);
	await chat.send("And gamma?");

	script([
		{
			reasoning: "Answer from what I found.",
			text: "I found none of them.",
		},
	]);
	await chat.send("Which did you look up?");

	return bodies.map((body) => toModelRequest(kind, body));
};
const plan = {
	title: "New bot",
	items: [
		{
			label: "Create the bot",
			status: "pending",
		},
	],
};

/**
 * Finds, loads, is refused and proposes a plan; resumes once the user
 * approved it, with a call that fails; deletes, failing once approved, and
 * retries, which the user denies; asks a third time, which the user
 * supersedes with a new message.
 */
const assistantConversation = async (kind: ProviderKind, modelId: string) => {
	const { model, bodies, script } = scriptedModel(kind, modelId);
	const toolLoading = providerToolLoading(kind, modelId);
	answers["bot.list"] = () =>
		Effect.succeed({
			data: [],
			rowCount: 0,
		});
	answers["bot.listDrafts"] = () =>
		Effect.succeed({
			data: [],
			rowCount: 0,
		});

	const assistant = conversation((history) =>
		createAssistantAgent({
			model,
			providerKind: kind,
			toolLoading,
			callSettings: {},
			docs: undefined,
			userContext: {
				user: {
					id: "user",
					name: "Ada",
					email: "ada@example.org",
				},
				organizationName: "Org",
				role: "member",
				capabilities: memberCapabilities,
			},
			features: [
				genUiFeature,
			],
			planApproved: isPlanApproved(history),
			loadedToolGroups: loadedToolGroupsOf(history),
			history,
			telemetryIds: telemetryIds(modelId),
			context,
			turn: createAssistantTurn({
				zedToken: undefined,
				chatId: "chat",
				replyId: "reply",
			}),
		}),
	);

	script([
		{
			reasoning: "Check for existing bots.",
			calls: [
				{
					name: "findBots",
					input: {},
				},
			],
		},
		{
			reasoning: "Load the bot tools.",
			calls: [
				{
					name: "loadTools",
					input: {
						groups: [
							"bots",
						],
					},
				},
			],
		},
		{
			reasoning: "Try creating it.",
			calls: [
				{
					name: "createBot",
					input: {
						name: "Helper",
						description: "Helps.",
					},
				},
			],
		},
		{
			reasoning: "Propose a plan first.",
			text: "Here is the plan.",
			calls: [
				{
					name: "updatePlan",
					input: plan,
				},
			],
		},
	]);
	await assistant.send("Make me a bot");

	script([
		{
			reasoning: "Approved; create it.",
			calls: [
				{
					name: "createBot",
					input: {
						name: "Helper",
						description: "Helps.",
					},
				},
			],
		},
		{
			reasoning: "It failed.",
			text: "Creating the bot failed.",
		},
	]);
	await assistant.decide(true);

	const deleteDraft: ToolCall = {
		name: "deleteBot",
		input: {
			ids: [
				crypto.randomUUID(),
			],
		},
	};
	script([
		{
			reasoning: "Delete the draft.",
			calls: [
				deleteDraft,
			],
		},
	]);
	await assistant.send("Delete the old draft");

	// The approved call fails before the first step; the turn pauses again, and the retry is denied.
	script([
		{
			reasoning: "It failed; try again.",
			calls: [
				deleteDraft,
			],
		},
	]);
	await assistant.decide(true);

	script([
		{
			reasoning: "Denied; ask once more.",
			text: "Deleting failed, and you declined the retry.",
			calls: [
				deleteDraft,
			],
		},
	]);
	await assistant.decide(false);

	script([
		{
			reasoning: "Show a checklist instead.",
			calls: [
				{
					name: "showChecklist",
					input: checklist,
				},
			],
		},
		{
			reasoning: "Wrap up.",
			text: "Here it is.",
		},
	]);
	await assistant.send("Keep it, show me a checklist instead");

	return {
		requests: bodies.map((body) => toModelRequest(kind, body)),
		toolLoading,
		/** The calls whose outputs a later turn reads as summary lines. */
		summarised: new Set(
			assistant
				.rows()
				.flatMap((row) => row.parts)
				.filter(
					(part) =>
						isToolUIPart(part) &&
						part.state === "output-available" &&
						!GEN_UI_TOOL_NAMES.some((name) => name === getToolName(part)),
				)
				.map((part) => (isToolUIPart(part) ? part.toolCallId : "")),
		),
	};
};

const reasoningIn = (request: ModelRequest) =>
	request.blocks.filter((block) => block.kind === "reasoning").length;

/** Each exception is needed: without it, the conversation shows a rewrite. */
const expectEachNeeded = (
	requests: ModelRequest[],
	exceptions: Exception[],
) => {
	for (const exception of exceptions) {
		expect({
			exception: exception.name,
			needed:
				rewrites(
					requests,
					exceptions.filter((other) => other !== exception),
				).length > 0,
		}).toEqual({
			exception: exception.name,
			needed: true,
		});
	}
};

describe.each([
	[
		"anthropic",
		"claude-opus-5-5",
	],
	[
		"openai-compatible",
		"model",
	],
] as const)("a chat on %s", (kind, modelId) => {
	const exceptions = [
		FINISHED_TURN_REASONING,
		FINISHED_TURN_TOOL_CALLS,
	];
	let requests: ModelRequest[] = [];
	beforeAll(async () => {
		requests = await chatConversation(kind, modelId);
	});

	test("sends each request as the previous one plus what came after it", () => {
		expect(requests).toHaveLength(7);
		expect(requests.some((request) => reasoningIn(request) > 0)).toBe(true);
		expect(rewrites(requests, exceptions)).toEqual([]);
	});

	test("rewrites only through the named exceptions", () => {
		expectEachNeeded(requests, exceptions);
	});
});

describe.each([
	[
		"anthropic",
		"claude-opus-5-5",
		"references",
	],
	[
		"anthropic",
		"claude-opus-4-1-20250805",
		"active-tools",
	],
	[
		"openai-compatible",
		"model",
		"active-tools",
	],
] as const)("the assistant on %s %s", (kind, modelId, loading) => {
	let requests: ModelRequest[] = [];
	let exceptions: Exception[] = [];
	beforeAll(async () => {
		const conversation = await assistantConversation(kind, modelId);
		expect(conversation.toolLoading.type).toBe(loading);
		requests = conversation.requests;
		exceptions = [
			FINISHED_TURN_REASONING,
			finishedTurnOutputs(conversation.summarised),
			...(loading === "active-tools"
				? [
						toolListChange(conversation.summarised),
					]
				: []),
		];
	});

	test("sends each request as the previous one plus what came after it", () => {
		expect(requests).toHaveLength(11);
		expect(requests.some((request) => reasoningIn(request) > 0)).toBe(true);
		expect(rewrites(requests, exceptions)).toEqual([]);
	});

	test("rewrites only through the named exceptions", () => {
		expectEachNeeded(requests, exceptions);
	});

	if (loading === "references") {
		test("declares the same tools in every request", () => {
			for (const request of requests) {
				expect(request.tools).toEqual(requests[0]?.tools ?? []);
			}
		});

		test("catches a rewrite in the turn in progress", () => {
			const last = requests.at(-1) as ModelRequest;
			const position = last.blocks
				.map((block) => block.kind)
				.lastIndexOf("reasoning");
			const rewritten = {
				...last,
				blocks: last.blocks.filter((_, index) => index !== position),
			};

			expect(position).toBeGreaterThan(-1);
			expect(
				rewrites(
					[
						last,
						rewritten,
					],
					exceptions,
				),
			).toEqual([
				{
					request: 1,
					at: position,
					sent: last.blocks[position],
					now: last.blocks[position + 1],
				},
			]);
		});
	}
});
