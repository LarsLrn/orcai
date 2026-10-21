import { context as otelContext } from "@opentelemetry/api";
import { AiError } from "@orcai/ai";
import type { ChatId, ChatMessageId } from "@orcai/core";
import { withActiveSpan } from "@orcai/observability";
import type {
	AiChatInput,
	ChatMessageMetadata,
	ClientToolOutput,
	ToolApprovalDecision,
} from "@orcai/schema";
import {
	type Agent,
	type AsyncIterableStream,
	createAgentUIStream,
	type FileUIPart,
	type InferAgentUIMessage,
	type LanguageModelUsage,
	type SystemModelMessage,
	smoothStream,
	type TextStreamPart,
	type TextUIPart,
	type ToolSet,
	type UIMessage,
	type UIMessageChunk,
	type UIMessageStreamOutcome,
} from "ai";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import { v4 as uuidv4 } from "uuid";
import { createAssistantAgent } from "@/lib/ai/agents/assistant-agent";
import { createChatAgent } from "@/lib/ai/agents/chat-agent";
import { forkChatTitleGenerationIfNeeded } from "@/lib/ai/effects/fork-chat-title-generation";
import {
	type Meter,
	type MeteredCallOutcome,
	startMeteredCall,
} from "@/lib/ai/metered-call/metered-call";
import {
	type AssistantTurn,
	createAssistantTurn,
} from "@/lib/ai/tools/assistant/turn-state";
import { latestPlanPart } from "@/lib/ai/turn-view/plan";
import type { ChatAgentUIMessage } from "@/lib/ai/types/chat-agent-message";
import { getChatMessageAttachments } from "@/lib/ai/types/chat-attachment";
import { buildAttachmentPromptPartCached } from "@/lib/ai/utils/chat-attachment-parts";
import { closeInvalidToolParts } from "@/lib/ai/utils/close-invalid-tool-parts";
import { closeLastReply } from "@/lib/ai/utils/close-pending-tool-parts";
import { streamErrorText } from "@/lib/ai/utils/stream-error-text";
import { getZedToken } from "@/lib/authz/zed-token";
import * as AppErrors from "@/lib/effect/utils/errors";
import {
	applyTurnDecisions,
	withoutContinuationClaim,
} from "./apply-turn-decisions";
import { fitContextWindow, requestTokens } from "./context-window";
import {
	isEmptyReply,
	type ReplyContent,
	ReplyStore,
	type StoredMessage,
} from "./reply-store";
import { type TurnRequester, type TurnSetup, turnSetup } from "./setup";

type TurnInput = TurnRequester & {
	chatId: ChatId;
	/** Stops the model call and the running tools. */
	stop: AbortSignal | undefined;
};

type TurnStreamOptions = {
	uiMessages: UIMessage[];
	originalMessages: UIMessage<ChatMessageMetadata>[];
	abortSignal: AbortSignal | undefined;
	maxSteps: number;
	replyId: ChatMessageId;
	onStepEnd: (usage: LanguageModelUsage) => void;
	onEnd: (event: {
		responseMessage: UIMessage<ChatMessageMetadata>;
		outcome: UIMessageStreamOutcome;
	}) => Promise<void>;
	onError: (error: unknown) => string;
	messageMetadata: (
		part: TextStreamPart<ToolSet>,
	) => ChatMessageMetadata | undefined;
};

/** An agent of either chat kind, streamed the same way. */
type TurnAgent = {
	tools: ToolSet;
	instructions: SystemModelMessage[];
	stream: (
		options: TurnStreamOptions,
	) => Promise<AsyncIterableStream<UIMessageChunk>>;
};

const turnAgent = <Tools extends ToolSet>({
	agent,
	instructions,
}: {
	agent: Agent<
		{
			maxSteps: number;
		},
		Tools
	>;
	instructions: SystemModelMessage[];
}): TurnAgent => ({
	tools: agent.tools,
	instructions,
	stream: (options) =>
		createAgentUIStream({
			agent,
			uiMessages: options.uiMessages,
			// Each chat kind stores only its own agent's tool parts.
			originalMessages: options.originalMessages as InferAgentUIMessage<
				typeof agent,
				ChatMessageMetadata
			>[],
			abortSignal: options.abortSignal,
			options: {
				maxSteps: options.maxSteps,
			},
			generateMessageId: () => options.replyId,
			experimental_transform: smoothStream({
				delayInMs: 20,
				chunking: "word",
			}),
			onStepEnd: (step) => options.onStepEnd(step.usage),
			onEnd: options.onEnd,
			onError: options.onError,
			messageMetadata: ({ part }) => options.messageMetadata(part),
		}),
});

/** The turn moved on or another request answered it first. */
const turnNotAwaiting = (message: string) =>
	new AppErrors.ConflictError({
		reason: "CHAT_TURN_NOT_AWAITING",
		message,
	});

const loadChat = ({ chatId, organizationId }: TurnInput) =>
	Effect.gen(function* () {
		const loaded = yield* (yield* ReplyStore).load(chatId);
		if (!loaded) {
			return yield* new AppErrors.NotFoundError({
				reason: "CHAT_NOT_FOUND",
				id: chatId,
				message: "Chat not found",
			});
		}
		if (
			loaded.chat.kind === "assistant" &&
			loaded.chat.organizationId !== organizationId
		) {
			return yield* new AppErrors.BadRequestError({
				reason: "ASSISTANT_ORGANIZATION_MISMATCH",
				message:
					"This assistant conversation belongs to another organisation. Switch to it to continue.",
			});
		}
		return loaded;
	});

/** The stored messages the model reads, without reserved empty replies. */
const historyOf = (messages: StoredMessage[]) =>
	messages
		.filter((message) => !isEmptyReply(message))
		.map(
			(message) =>
				({
					id: message.id,
					role: message.role,
					parts: message.parts,
					metadata: message.metadata,
					attachments: message.attachments,
				}) as ChatAgentUIMessage,
		);

const buildAgent = ({
	setup,
	input,
	history,
	replyId,
	turnZedToken,
}: {
	setup: TurnSetup;
	input: TurnInput;
	history: ChatAgentUIMessage[];
	replyId: ChatMessageId;
	turnZedToken: string | undefined;
}): {
	agent: TurnAgent;
	assistantTurn: AssistantTurn | undefined;
} => {
	const telemetryIds = {
		organizationId: input.organizationId,
		chatId: input.chatId,
		providerId: setup.providerId,
		modelId: setup.modelId,
	};
	if (setup.agent.kind === "chat") {
		return {
			agent: turnAgent(
				createChatAgent({
					model: setup.model,
					systemPrompt: setup.agent.systemPrompt,
					databaseBlocks: setup.agent.databaseBlocks,
					features: setup.agent.features,
					callSettings: setup.callSettings,
					compaction: setup.compaction,
					telemetryIds,
					context: input.context,
				}),
			),
			assistantTurn: undefined,
		};
	}

	const assistantTurn = createAssistantTurn({
		zedToken: turnZedToken,
		chatId: input.chatId,
		replyId,
	});
	return {
		agent: turnAgent(
			createAssistantAgent({
				model: setup.model,
				callSettings: setup.callSettings,
				compaction: setup.compaction,
				docs: setup.agent.docs,
				userContext: setup.agent.userContext,
				features: setup.agent.features,
				history,
				plan: latestPlanPart(history)?.input,
				telemetryIds,
				context: input.context,
				turn: assistantTurn,
			}),
		),
		assistantTurn,
	};
};

const meterTurn = ({
	setup,
	input,
	replyId,
	messages,
}: {
	setup: TurnSetup;
	input: TurnInput;
	replyId: ChatMessageId;
	messages: ChatAgentUIMessage[];
}) =>
	startMeteredCall({
		appRequestId: replyId,
		organizationId: input.organizationId,
		userId: input.user.id,
		providerId: setup.providerId,
		providerModelId: setup.modelId,
		maxSteps: setup.maxSteps,
		maxOutputTokens: setup.callSettings.maxOutputTokens,
		messages,
	});

/** User messages carry their attachments as parts the model reads. */
const withAttachmentParts = (messages: ChatAgentUIMessage[]) => {
	const cache = new Map<string, FileUIPart | TextUIPart>();
	return Effect.forEach(
		messages,
		(message) => {
			const attachments =
				message.role === "user" ? getChatMessageAttachments(message) : [];
			return attachments.length === 0
				? Effect.succeed(message)
				: Effect.forEach(
						attachments,
						(attachment) =>
							buildAttachmentPromptPartCached({
								attachment,
								cache,
							}),
						{
							concurrency: 3,
						},
					).pipe(
						Effect.map((parts) => ({
							...message,
							parts: [
								...message.parts,
								...parts,
							],
						})),
					);
		},
		{
			concurrency: "unbounded",
		},
	);
};

/** The prompt within the model's context window, refused when even its latest turn does not fit. */
const fitPrompt = ({
	setup,
	agent,
	prompt,
	replyId,
}: {
	setup: TurnSetup;
	agent: TurnAgent;
	prompt: ChatAgentUIMessage[];
	replyId: ChatMessageId;
}) =>
	Effect.gen(function* () {
		const fit = fitContextWindow({
			messages: prompt,
			replyId,
			requestTokens: yield* Effect.promise(() => requestTokens(agent)),
			budget: setup.budget,
			compaction: setup.compaction,
		});
		if (!fit.fits) {
			return yield* new AppErrors.BadRequestError({
				reason: "CHAT_CONTEXT_TOO_LONG",
				message: "The latest turn does not fit the model's context window.",
			});
		}
		return fit;
	});

const meteredOutcome = (
	status: UIMessageStreamOutcome["status"],
): MeteredCallOutcome =>
	status === "failed"
		? "failed"
		: status === "completed"
			? "completed"
			: "aborted";

/** Streams the agent onto the reply, then settles the reply and the meter. */
const streamTurn = ({
	agent,
	assistantTurn,
	input,
	replyId,
	messages,
	fit,
	meter,
	contextWindow,
	operation,
}: {
	agent: TurnAgent;
	assistantTurn: AssistantTurn | undefined;
	input: TurnInput;
	replyId: ChatMessageId;
	messages: ChatAgentUIMessage[];
	fit: {
		messages: ChatAgentUIMessage[];
		trimmed: boolean;
		estimate: number;
	};
	meter: Meter;
	contextWindow: number | null;
	operation: string;
}) =>
	Effect.gen(function* () {
		const store = yield* ReplyStore;
		const services = yield* Effect.context();
		// The stream outlives the request handler; its callbacks rejoin the request trace.
		const traceContext = otelContext.active();
		const run = (effect: Effect.Effect<void>) =>
			otelContext.with(traceContext, () =>
				Effect.runPromiseWith(services)(withActiveSpan(effect)),
			);
		// A continuation reads on from what this turn wrote.
		const writtenZedToken = () => {
			const zedToken = assistantTurn?.zedToken.current();

			return zedToken === undefined
				? {}
				: {
						zedToken,
					};
		};

		const settledReply = ({
			parts,
			metadata,
		}: Pick<UIMessage<ChatMessageMetadata>, "parts" | "metadata">) =>
			({
				// A turn that produced nothing leaves no reply.
				parts: parts.every((part) => part.type === "step-start") ? [] : parts,
				metadata: {
					...withoutContinuationClaim(metadata ?? {}),
					...writtenZedToken(),
				},
			}) satisfies ReplyContent;

		return yield* Effect.tryPromise({
			try: () =>
				agent.stream({
					uiMessages: fit.messages,
					originalMessages: messages as UIMessage<ChatMessageMetadata>[],
					abortSignal: input.stop,
					maxSteps: meter.maxSteps,
					replyId,
					onStepEnd: meter.step,
					onEnd: ({ responseMessage, outcome }) =>
						run(
							store
								.settle({
									chatId: input.chatId,
									replyId,
									reply: settledReply(responseMessage),
								})
								.pipe(
									Effect.catchCause((cause) =>
										Effect.logError(
											`chat reply ${replyId} could not be settled ${Cause.pretty(cause)}`,
										),
									),
									Effect.andThen(meter.settle(meteredOutcome(outcome.status))),
								),
						),
					// Also called for every failed tool call, whose error text it returns.
					onError: (error) => {
						void run(
							Effect.logError({
								error: error instanceof Error ? error.message : String(error),
								message: "AI stream error",
							}),
						);
						return streamErrorText(error);
					},
					messageMetadata: (part) => {
						if (part.type === "finish-step") {
							return {
								model: part.response.modelId,
								...(part.usage.totalTokens !== undefined && {
									contextTokens: part.usage.totalTokens,
								}),
								// Lets the client read what the turn wrote, such as the names on its cards.
								...writtenZedToken(),
							};
						}
						if (part.type === "finish") {
							return {
								totalUsage: part.totalUsage,
								...(contextWindow !== null && {
									contextWindow,
								}),
								contextEstimate: fit.estimate,
								...(fit.trimmed && {
									historyTrimmed: true,
								}),
								...(part.finishReason === "tool-calls" &&
									meter.spent() && {
										stepLimitReached: true,
									}),
							};
						}
					},
				}),
			catch: (cause) =>
				new AiError({
					operation,
					cause,
				}),
		});
	});

/** Answers a new user message: reserves the question and its reply, then streams the reply. */
export const startTurn = (
	input: TurnInput & {
		message: AiChatInput["message"];
	},
) =>
	Effect.gen(function* () {
		const store = yield* ReplyStore;
		const { chat, messages: stored } = yield* loadChat(input);
		const setup = yield* turnSetup(chat, input);
		const replyId = uuidv4() as ChatMessageId;
		const history = historyOf(stored);
		const question = {
			id: input.message.id,
			role: "user",
			parts: input.message.parts,
			metadata: input.message.metadata ?? {},
			attachments: getChatMessageAttachments(input.message),
		};
		const { agent, assistantTurn } = buildAgent({
			setup,
			input,
			// The question supersedes a plan the last reply still proposes.
			history: [
				...history,
				question as ChatAgentUIMessage,
			],
			replyId,
			turnZedToken: getZedToken(input.context),
		});
		const { closedHistory, closedReply } = closeLastReply(history, agent.tools);
		const messages = yield* Effect.promise(() =>
			closeInvalidToolParts(
				[
					...closedHistory,
					question as ChatAgentUIMessage,
				],
				agent.tools,
			),
		);

		const fit = yield* fitPrompt({
			setup,
			agent,
			prompt: yield* withAttachmentParts(messages),
			replyId,
		});
		const meter = yield* meterTurn({
			setup,
			input,
			replyId,
			messages: fit.messages,
		});

		return yield* Effect.gen(function* () {
			// The reply is reserved with the question, so a later turn always lands after it.
			yield* store
				.reserve({
					chatId: chat.id,
					closedReply: closedReply && {
						id: closedReply.id,
						parts: closedReply.parts,
					},
					question,
					replyId,
				})
				.pipe(
					Effect.mapError((error) =>
						error instanceof AppErrors.BadRequestError
							? error
							: new AppErrors.BadRequestError({
									reason: "CHAT_MESSAGE_CREATE_FAILED",
									message: "Failed to create user message",
									cause: error,
								}),
					),
				);

			yield* forkChatTitleGenerationIfNeeded({
				chatId: chat.id,
				currentTitle: chat.title,
				model: setup.model.language,
				organizationId: input.organizationId,
				providerId: setup.providerId,
				providerModelId: setup.modelId,
				userId: input.user.id,
				userMessage: question,
			});

			return yield* streamTurn({
				agent,
				assistantTurn,
				input,
				replyId,
				messages,
				fit,
				meter,
				contextWindow: setup.tokenLimits.contextWindow,
				operation: "chatTurn.start",
			}).pipe(
				Effect.onError(() =>
					store
						.settle({
							chatId: chat.id,
							replyId,
							reply: {
								parts: [],
								metadata: {},
							},
						})
						.pipe(Effect.ignore),
				),
			);
		}).pipe(Effect.onError(() => meter.settle("unused")));
	});

/** Resumes a paused assistant reply once its last step is answered. */
export const continueTurn = (
	input: TurnInput & {
		replyId: ChatMessageId;
		decisions: ToolApprovalDecision[];
		toolOutputs: ClientToolOutput[];
		/** What a client tool's write returned, which also covers the paused turn's writes. */
		clientZedToken: string | undefined;
	},
) =>
	Effect.gen(function* () {
		const store = yield* ReplyStore;
		const { chat, messages: stored } = yield* loadChat(input);
		if (chat.kind !== "assistant") {
			return yield* turnNotAwaiting("Only assistant replies wait for answers.");
		}
		const setup = yield* turnSetup(chat, input);
		// Quota and the fit come before the claim, so a refused continuation stores nothing.
		const unclaimed = historyOf(stored);
		const unclaimedFit = yield* fitPrompt({
			setup,
			agent: buildAgent({
				setup,
				input,
				history: unclaimed,
				replyId: input.replyId,
				turnZedToken: undefined,
			}).agent,
			prompt: unclaimed,
			replyId: input.replyId,
		});
		const meter = yield* meterTurn({
			setup,
			input,
			replyId: input.replyId,
			messages: unclaimedFit.messages,
		});

		return yield* Effect.gen(function* () {
			const now = new Date();
			const claimed = yield* store.claim({
				chatId: chat.id,
				replyId: input.replyId,
				update: (reply) => {
					const applied = applyTurnDecisions({
						messageId: input.replyId,
						lastMessage: reply && {
							id: reply.id,
							role: reply.role,
							parts: reply.parts as UIMessage["parts"],
							continuedAt: reply.metadata.continuedAt,
						},
						decisions: input.decisions,
						toolOutputs: input.toolOutputs,
						now,
					});
					if (!applied.ok) {
						return Effect.fail(
							applied.reason === "CHAT_TURN_NOT_AWAITING"
								? turnNotAwaiting(applied.message)
								: new AppErrors.BadRequestError({
										reason: applied.reason,
										message: applied.message,
									}),
						);
					}
					return Effect.succeed({
						parts: applied.parts,
						metadata: {
							...reply?.metadata,
							continuedAt: now.toISOString(),
						},
					});
				},
			});

			return yield* Effect.gen(function* () {
				const history = historyOf(
					stored.map((message) =>
						message.id === input.replyId
							? {
									...message,
									...claimed,
								}
							: message,
					),
				);
				const { agent, assistantTurn } = buildAgent({
					setup,
					input,
					history,
					replyId: input.replyId,
					turnZedToken:
						input.toolOutputs.length > 0 && input.clientZedToken !== undefined
							? input.clientZedToken
							: (claimed.metadata.zedToken ?? getZedToken(input.context)),
				});
				const messages = yield* Effect.promise(() =>
					closeInvalidToolParts(history, agent.tools),
				);
				const fit = yield* fitPrompt({
					setup,
					agent,
					prompt: yield* withAttachmentParts(messages),
					replyId: input.replyId,
				});

				return yield* streamTurn({
					agent,
					assistantTurn,
					input,
					replyId: input.replyId,
					messages,
					fit,
					meter,
					contextWindow: setup.tokenLimits.contextWindow,
					operation: "chatTurn.continue",
				});
			}).pipe(
				// The decisions stay and the claim goes, so the continuation can be retried.
				Effect.onError(() =>
					store
						.settle({
							chatId: chat.id,
							replyId: input.replyId,
							reply: {
								parts: claimed.parts,
								metadata: withoutContinuationClaim(claimed.metadata),
							},
						})
						.pipe(Effect.ignore),
				),
			);
		}).pipe(Effect.onError(() => meter.settle("unused")));
	});
