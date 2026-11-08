import { context as otelContext } from "@opentelemetry/api";
import { AiError, meteredStep } from "@orcai/ai";
import { type ChatId, type ChatMessageId, SUMMARY_METADATA } from "@orcai/core";
import type { DB } from "@orcai/db";
import { withActiveSpan } from "@orcai/observability";
import {
	type MeteredCall,
	type MeteredCallOutcome,
	promptTokens,
	startMeteredCall,
} from "@orcai/quota";
import type {
	AiChatInput,
	ChatMessageMetadata,
	ClientToolOutput,
	KeptUploads,
	ToolApprovalDecision,
} from "@orcai/schema";
import {
	createUIMessageStream,
	type TextStreamPart,
	type ToolSet,
	type UIMessage,
	type UIMessageStreamOutcome,
} from "ai";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import { v4 as uuidv4 } from "uuid";
import { createAssistantAgent } from "@/lib/ai/agents/assistant-agent";
import { createChatAgent } from "@/lib/ai/agents/chat-agent";
import { localDate } from "@/lib/ai/agents/chat-agent-system-prompt";
import type { StreamedMetadata, TurnAgent } from "@/lib/ai/agents/turn-agent";
import {
	chatSources,
	citableText,
	displayCallText,
	type StreamedCitations,
} from "@/lib/ai/citations/chat-sources";
import { forkChatTitleGenerationIfNeeded } from "@/lib/ai/effects/fork-chat-title-generation";
import {
	type AssistantTurn,
	createAssistantTurn,
} from "@/lib/ai/tools/assistant/turn-state";
import {
	mergeTurnWrites,
	RunningCallsWait,
} from "@/lib/ai/tools/assistant/turn-writes";
import { toolKindOf } from "@/lib/ai/tools/registry";
import { pausedStep } from "@/lib/ai/turn-view/paused-step";
import { latestPlanPart } from "@/lib/ai/turn-view/plan";
import {
	type ChatAgentUIMessage,
	toChatAgentMessages,
	toChatAgentParts,
} from "@/lib/ai/types/chat-agent-message";
import { closeInvalidToolParts } from "@/lib/ai/utils/close-invalid-tool-parts";
import {
	closeLastReply,
	closeRunningToolParts,
} from "@/lib/ai/utils/close-pending-tool-parts";
import { streamErrorText } from "@/lib/ai/utils/stream-error-text";
import { readRevision } from "@/lib/authz/zed-token";
import { chatBotUsable, requireWritableChat } from "@/lib/chats/read-only";
import * as AppErrors from "@/lib/effect/utils/errors";
import {
	applyTurnDecisions,
	isContinuationClaimLive,
	withoutContinuationClaim,
} from "./apply-turn-decisions";
import { attachAssets, attachmentReader } from "./attachments";
import { fitContextWindow, readForFit, requestTokens } from "./context-window";
import {
	isEmptyReply,
	type ReplyContent,
	ReplyStore,
	type StoredMessage,
} from "./reply-store";
import {
	type TurnRequester,
	type TurnSetup,
	turnSetup,
	turnStartToken,
} from "./setup";
import { summarizeHistory } from "./summary";

type TurnInput = TurnRequester & {
	chatId: ChatId;
	/** Stops the model call and the running tools. */
	stop: AbortSignal | undefined;
};

/** The turn moved on or another request answered it first. */
const turnNotAwaiting = (message: string) =>
	new AppErrors.ConflictError({
		reason: "CHAT_TURN_NOT_AWAITING",
		message,
	});

const loadChat = ({
	chatId,
	organizationId,
	user,
	context,
	zedToken,
}: Pick<TurnInput, "chatId" | "organizationId" | "context" | "zedToken"> & {
	user: Pick<TurnInput["user"], "id">;
}) =>
	Effect.gen(function* () {
		const loaded = yield* (yield* ReplyStore).load(chatId);
		if (!loaded) {
			return yield* new AppErrors.NotFoundError({
				reason: "CHAT_NOT_FOUND",
				id: chatId,
				message: "Chat not found",
			});
		}
		const { chat } = loaded;
		yield* requireWritableChat(chat, {
			activeOrganizationId: organizationId,
			botUsable: chatBotUsable(chat, {
				userId: user.id,
				zedToken: readRevision(context, {
					zedToken,
				}),
			}),
		});
		return loaded;
	});

/** The stored messages the model reads, leaving out those without readable parts, like a reserved reply. */
const historyOf = (messages: StoredMessage[]) =>
	toChatAgentMessages(messages.filter((message) => !isEmptyReply(message)));

const buildAgent = ({
	setup,
	input,
	history,
	turnZedToken,
	runningCallsWait,
}: {
	setup: TurnSetup;
	input: TurnInput;
	history: ChatAgentUIMessage[];
	turnZedToken: string | undefined;
	runningCallsWait?: () => AbortSignal;
}): {
	agent: TurnAgent;
	assistantTurn: AssistantTurn | undefined;
} => {
	const telemetryIds = {
		organizationId: input.organizationId,
		chatId: input.chatId,
		providerId: setup.model.providerId,
		modelId: setup.model.modelId,
	};
	const sources = chatSources(history);
	const today = localDate(input.timeZone);
	if (setup.agent.kind === "chat") {
		return {
			agent: createChatAgent({
				model: setup.model,
				systemPrompt: setup.agent.systemPrompt,
				today,
				repositories: setup.agent.repositories,
				features: setup.agent.features,
				webSearch: setup.agent.webSearch,
				callSettings: setup.callSettings,
				compaction: setup.compaction,
				telemetryIds,
				context: input.context,
				history,
				hasAttachments: history.some(
					(message) =>
						message.role === "user" && (message.attachments?.length ?? 0) > 0,
				),
				sources,
			}),
			assistantTurn: undefined,
		};
	}

	const assistantTurn = createAssistantTurn({
		zedToken: turnZedToken,
		runningCallsWait,
	});
	return {
		agent: createAssistantAgent({
			model: setup.model,
			callSettings: setup.callSettings,
			compaction: setup.compaction,
			docs: setup.agent.docs,
			userContext: setup.agent.userContext,
			features: setup.agent.features,
			history,
			plan: latestPlanPart(history)?.input,
			today,
			telemetryIds,
			context: input.context,
			turn: assistantTurn,
			sources,
		}),
		assistantTurn,
	};
};

/** Reserves one request of the fitted prompt, its instructions and tools included, for each step. */
const meterTurn = ({
	setup,
	input,
	replyId,
	fit,
}: {
	setup: TurnSetup;
	input: TurnInput;
	replyId: ChatMessageId;
	fit: PromptFit;
}) =>
	startMeteredCall({
		appRequestId: replyId,
		organizationId: input.organizationId,
		userId: input.user.id,
		providerId: setup.model.providerId,
		modelId: setup.model.modelId,
		botId: setup.botId,
		maxRequests: setup.maxSteps,
		maxOutputTokens: setup.callSettings.maxOutputTokens,
		inputTokens: fit.requestTokens + promptTokens(fit.messages),
	});

/**
 * The prompt within the model's context window, refused when even its latest
 * turn does not fit, and what each step's messages may take without native
 * compaction.
 */
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
		const request = yield* Effect.promise(() =>
			requestTokens({
				instructions: agent.instructions,
				tools: agent.offeredTools(),
			}),
		);
		const fit = fitContextWindow({
			messages: prompt,
			replyId,
			requestTokens: request,
			budget: setup.budget,
			compaction: setup.compaction,
		});
		if (!fit.fits) {
			return yield* new AppErrors.BadRequestError({
				reason: "CHAT_CONTEXT_TOO_LONG",
				message: "The latest turn does not fit the model's context window.",
			});
		}
		return {
			...fit,
			requestTokens: request,
			promptTokens: setup.compaction.native ? undefined : fit.stepTokens,
		};
	});

type PromptFit = Effect.Success<ReturnType<typeof fitPrompt>>;

const meteredOutcome = (
	status: UIMessageStreamOutcome["status"],
): MeteredCallOutcome =>
	status === "failed" || status === "completed" ? status : "cancelled";

/** The part our own summary is streamed as, ahead of the agent's parts. */
const SUMMARY_PART_ID = "summary";

/**
 * Streams the agent onto the reply, then settles the reply and the meter.
 * When the fit asks for a summary, the reply first streams our own summary of
 * the history, and the agent answers from the prompt that starts at it; a
 * failed summary leaves the prompt as fitted without it.
 */
const streamTurn = ({
	agent,
	assistantTurn,
	input,
	setup,
	replyId,
	messages,
	prompt,
	fit,
	meter,
	operation,
}: {
	agent: TurnAgent;
	assistantTurn: AssistantTurn | undefined;
	input: TurnInput;
	setup: TurnSetup;
	replyId: ChatMessageId;
	messages: ChatAgentUIMessage[];
	/** What the fit read, attachments included. */
	prompt: ChatAgentUIMessage[];
	fit: PromptFit;
	meter: MeteredCall;
	operation: string;
}) =>
	Effect.gen(function* () {
		const store = yield* ReplyStore;
		const services = yield* Effect.context<DB>();
		// The stream outlives the request handler; its callbacks rejoin the request trace.
		const traceContext = otelContext.active();
		const run = <A>(effect: Effect.Effect<A, never, DB>) =>
			otelContext.with(traceContext, () =>
				Effect.runPromiseWith(services)(withActiveSpan(effect)),
			);
		const { contextWindow } = setup.model.tokenLimits;
		const stop = AbortSignal.any([
			...(input.stop
				? [
						input.stop,
					]
				: []),
			meter.deadline,
		]);
		let timeLimitReached = false;
		meter.deadline.addEventListener(
			"abort",
			() => {
				timeLimitReached = !input.stop?.aborted;
			},
			{
				once: true,
			},
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

		const { sources } = agent;
		const continued = messages.find(({ id }) => id === replyId);
		// A continuation adds to what the turns before it wrote.
		const continuedWrites =
			(continued?.metadata as ChatMessageMetadata | undefined)?.writes ?? [];
		const turnWrites = () =>
			mergeTurnWrites(continuedWrites, assistantTurn?.writes.all() ?? []);
		let streamedWrites = continuedWrites.length;
		/** Every write so far, once a call wrote since the client last got them. */
		const changedWrites = () => {
			const writes = turnWrites();
			if (writes.length === streamedWrites) {
				return undefined;
			}
			streamedWrites = writes.length;

			return {
				writes,
			};
		};
		// What the reply may cite in: what a continued reply wrote, then what streams.
		let citable = citableText(continued?.parts ?? []);
		// What the client holds: it merges each streamed set into the reply's metadata.
		let shown: StreamedCitations = {
			...(continued?.metadata as ChatMessageMetadata | undefined)?.citations,
		};
		/** The citations that changed since the client last got them; null withdraws one. */
		const citationChanges = () => {
			const cited = sources.citations(citable);
			const changes: StreamedCitations = Object.fromEntries([
				...Object.entries(cited).filter(
					([ref, citation]) =>
						JSON.stringify(shown[ref]) !== JSON.stringify(citation),
				),
				...Object.keys(shown)
					.filter((ref) => shown[ref] !== null && !Object.hasOwn(cited, ref))
					.map((ref) => [
						ref,
						null,
					]),
			]);
			shown = {
				...shown,
				...changes,
			};

			return Object.keys(changes).length > 0 ? changes : undefined;
		};
		const changedCitations = () => {
			const citations = citationChanges();

			return (
				citations && {
					citations,
				}
			);
		};

		const settledReply = ({
			parts,
			metadata,
		}: Pick<UIMessage<StreamedMetadata>, "parts" | "metadata">) => {
			// The whole reply resolves again, so a ref that became ambiguous loses its entry.
			const { citations: _, ...streamed } = metadata ?? {};
			const settled = withoutContinuationClaim(streamed);
			const citations = sources.citations(citableText(parts));
			const writes = turnWrites();

			return {
				// A turn that produced nothing leaves no reply.
				parts: parts.every((part) => part.type === "step-start")
					? []
					: // A call the turn stopped mid-run needs a result before the model reads the reply again.
						closeRunningToolParts(parts, agent.tools),
				metadata: {
					...settled,
					...(Object.keys(citations).length > 0 && {
						citations,
					}),
					...writtenZedToken(),
					...(writes.length > 0 && {
						writes,
					}),
				},
			} satisfies ReplyContent;
		};
		const logCollisions = () =>
			Effect.forEach(
				sources.collisions(),
				({ ref, identities }) =>
					Effect.logWarning(
						`chat ${input.chatId} ref ${ref} names more than one source: ${identities.join(", ")}`,
					),
				{
					discard: true,
				},
			);

		const partMetadata = (
			part: TextStreamPart<ToolSet>,
			sent: PromptFit,
		): StreamedMetadata | undefined => {
			if (part.type === "text-start") {
				citable += "\n";
			}
			if (part.type === "text-delta") {
				citable += part.text;
				return part.text.includes(">") ? changedCitations() : undefined;
			}
			// A call's sources can make a cited ref ambiguous.
			if (part.type === "tool-result") {
				return changedCitations();
			}
			if (
				part.type === "tool-call" &&
				toolKindOf({
					type: `tool-${part.toolName}`,
				}) === "display"
			) {
				citable += `\n${displayCallText(part.input)}`;
				return changedCitations();
			}
			if (part.type === "abort" && timeLimitReached) {
				return {
					timeLimitReached: true,
				};
			}
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
				const citations = citationChanges();
				return {
					totalUsage: part.totalUsage,
					...(citations && {
						citations,
					}),
					...(contextWindow !== null && {
						contextWindow,
					}),
					contextEstimate: sent.estimate,
					...(sent.trimmed && {
						historyTrimmed: true,
					}),
					// Explicit, so a finished continuation clears what the paused reply said.
					stepLimitReached: part.finishReason === "tool-calls" && meter.spent(),
					contextLimitReached: agent.contextFull(),
					timeLimitReached: false,
					interrupted: part.finishReason === "interrupted",
				};
			}
		};

		const streamAgent = (
			sent: PromptFit,
			originalMessages: ChatAgentUIMessage[],
		) =>
			agent.stream({
				uiMessages: sent.messages,
				originalMessages: originalMessages as UIMessage<ChatMessageMetadata>[],
				abortSignal: stop,
				maxSteps: meter.maxRequests,
				promptTokens: sent.promptTokens,
				replyId,
				onStepEnd: (step) => run(meter.record(meteredStep(step))),
				onEnd: async ({ responseMessage, outcome }) => {
					// A stopped stream ends before the calls it started, and a change runs to its end.
					await assistantTurn?.writes.settled();
					return run(
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
								Effect.andThen(Effect.suspend(logCollisions)),
							),
					);
				},
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
				// A write reaches the client with the next part, also when the turn then fails or stops.
				messageMetadata: (part) => {
					const metadata = partMetadata(part, sent);
					const writes = changedWrites();

					return writes
						? {
								...metadata,
								...writes,
							}
						: metadata;
				},
			});

		const history = fit.summarize;
		if (history === undefined) {
			return yield* Effect.tryPromise({
				try: () => streamAgent(fit, messages),
				catch: (cause) =>
					new AiError({
						operation,
						cause,
					}),
			});
		}

		return createUIMessageStream({
			execute: async ({ writer }) => {
				writer.write({
					type: "start",
					messageId: replyId,
				});
				writer.write({
					type: "text-start",
					id: SUMMARY_PART_ID,
					providerMetadata: SUMMARY_METADATA,
				});
				const summary = await run(
					summarizeHistory({
						setup,
						requester: input,
						replyId,
						history,
						stop,
					}),
				);
				if (summary !== undefined) {
					writer.write({
						type: "text-delta",
						id: SUMMARY_PART_ID,
						delta: summary,
					});
				}
				writer.write({
					type: "text-end",
					id: SUMMARY_PART_ID,
				});

				const reply = {
					id: replyId,
					role: "assistant",
					parts: [
						{
							type: "text",
							text: summary ?? "",
							state: "done",
							providerMetadata: SUMMARY_METADATA,
						},
					],
					metadata: {},
				} as ChatAgentUIMessage;
				const summarized =
					summary === undefined
						? undefined
						: await run(
								fitPrompt({
									setup,
									agent,
									prompt: [
										...prompt,
										reply,
									],
									replyId,
								}).pipe(Effect.option),
							);
				try {
					writer.merge(
						summarized?._tag === "Some"
							? await streamAgent(summarized.value, [
									...messages,
									reply,
								])
							: await streamAgent(fit, messages),
					);
				} catch (error) {
					await run(
						store
							.settle({
								chatId: input.chatId,
								replyId,
								reply: {
									parts: [],
									metadata: {},
								},
							})
							.pipe(Effect.ignore, Effect.andThen(meter.settle("unused"))),
					);
					throw error;
				}
			},
			onError: streamErrorText,
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
		const reader = {
			userId: input.user.id,
			zedToken: readRevision(input.context, input),
		};
		const question = {
			id: input.message.id,
			role: "user",
			parts: input.message.parts,
			metadata: {},
			attachments: yield* attachAssets(input.message.attachments, reader),
		};
		const { agent, assistantTurn } = buildAgent({
			setup,
			input,
			// The question supersedes a plan the last reply still proposes.
			history: [
				...history,
				question as ChatAgentUIMessage,
			],
			turnZedToken: turnStartToken(input),
			runningCallsWait: yield* RunningCallsWait,
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

		const prompt = yield* readForFit({
			messages,
			budget: setup.budget,
			compaction: setup.compaction,
			read: attachmentReader(reader),
		});
		// What the model read of the question's files is stored with it.
		const storedQuestion = {
			...question,
			attachments:
				prompt.find((message) => message.id === question.id)?.attachments ??
				question.attachments,
		};
		const fit = yield* fitPrompt({
			setup,
			agent,
			prompt,
			replyId,
		});
		const meter = yield* meterTurn({
			setup,
			input,
			replyId,
			fit,
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
					question: storedQuestion,
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
				chatModel: setup.model,
				organizationId: input.organizationId,
				userId: input.user.id,
				userMessage: question,
			});

			return yield* streamTurn({
				agent,
				assistantTurn,
				input,
				setup,
				replyId,
				messages,
				prompt,
				fit,
				meter,
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

/** Resumes a paused reply once its last step is answered. */
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
		const setup = yield* turnSetup(chat, input);
		// Quota and the fit come before the claim, so a refused continuation stores nothing.
		const unclaimed = historyOf(stored);
		const unclaimedFit = yield* fitPrompt({
			setup,
			agent: buildAgent({
				setup,
				input,
				history: unclaimed,
				turnZedToken: undefined,
			}).agent,
			prompt: unclaimed,
			replyId: input.replyId,
		});
		const meter = yield* meterTurn({
			setup,
			input,
			replyId: input.replyId,
			fit: unclaimedFit,
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
							parts: toChatAgentParts(reply.parts),
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
					const {
						uploads: _,
						// The continuation finds out anew why the reply stops.
						stepLimitReached: _step,
						contextLimitReached: _context,
						timeLimitReached: _time,
						interrupted: _interrupted,
						...metadata
					} = reply?.metadata ?? {};
					return Effect.succeed({
						parts: applied.parts,
						metadata: {
							...metadata,
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
					turnZedToken:
						input.toolOutputs.length > 0 && input.clientZedToken !== undefined
							? input.clientZedToken
							: (claimed.metadata.zedToken ?? turnStartToken(input)),
					runningCallsWait: yield* RunningCallsWait,
				});
				const messages = yield* Effect.promise(() =>
					closeInvalidToolParts(history, agent.tools),
				);
				const prompt = yield* readForFit({
					messages,
					budget: setup.budget,
					compaction: setup.compaction,
					read: attachmentReader({
						userId: input.user.id,
						zedToken: readRevision(input.context, input),
					}),
				});
				const fit = yield* fitPrompt({
					setup,
					agent,
					prompt,
					replyId: input.replyId,
				});

				return yield* streamTurn({
					agent,
					assistantTurn,
					input,
					setup,
					replyId: input.replyId,
					messages,
					prompt,
					// The summary is a reply's first part, which a continued reply has already written.
					fit: {
						...fit,
						summarize: undefined,
					},
					meter,
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

/** Stores the files a waiting `requestUpload` call lists, so the reply shows them after a reload. */
export const keepUploads = ({
	replyId,
	toolCallId,
	kept,
	...input
}: Pick<TurnInput, "chatId" | "organizationId" | "context"> & {
	user: Pick<TurnInput["user"], "id">;
	replyId: ChatMessageId;
	toolCallId: string;
	kept: KeptUploads;
}) =>
	Effect.gen(function* () {
		const { chat } = yield* loadChat(input);
		const chatId = chat.id;
		const now = new Date();
		const stored = yield* (yield* ReplyStore).claim({
			chatId,
			replyId,
			update: (reply) => {
				const waiting =
					reply &&
					!isContinuationClaimLive(reply.metadata.continuedAt, now) &&
					pausedStep({
						role: reply.role,
						parts: toChatAgentParts(reply.parts),
					})?.awaiting.some(
						(part) =>
							part.toolCallId === toolCallId &&
							part.type === "tool-requestUpload",
					);
				if (!waiting) {
					return Effect.fail(
						turnNotAwaiting("The upload request is no longer waiting."),
					);
				}
				return Effect.succeed({
					metadata: {
						...reply.metadata,
						uploads: {
							...reply.metadata.uploads,
							[toolCallId]: kept,
						},
					},
				});
			},
		});
		return stored.metadata.uploads?.[toolCallId] ?? kept;
	});
