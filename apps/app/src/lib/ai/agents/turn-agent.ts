import {
	type AgentModel,
	aiTelemetry,
	type MeterStep,
	type ProviderCompaction,
} from "@orcai/ai";
import type { ChatMessageId } from "@orcai/core";
import type { ChatMessageMetadata } from "@orcai/schema";
import {
	type AsyncIterableStream,
	createAgentUIStream,
	type InferAgentUIMessage,
	type ModelMessage,
	Output,
	type StepResult,
	type SystemModelMessage,
	smoothStream,
	type TextStreamPart,
	ToolLoopAgent,
	type ToolLoopAgentSettings,
	type ToolSet,
	type UIMessage,
	type UIMessageChunk,
	type UIMessageStreamOutcome,
} from "ai";
import type { ChatCallSettings } from "@/lib/ai/agents/chat-call-settings";
import { repairRepositoryToolCall } from "@/lib/ai/agents/repair-tool-call";
import { stepBudgetOptionsSchema } from "@/lib/ai/agents/step-budget";
import {
	createStepShaper,
	lastStepToolCalls,
} from "@/lib/ai/agents/step-request";
import type {
	ChatSources,
	StreamedCitations,
} from "@/lib/ai/citations/chat-sources";

/** What a reply streams as metadata; the settled reply stores no withdrawn citation. */
export type StreamedMetadata = Omit<ChatMessageMetadata, "citations"> & {
	citations?: StreamedCitations;
};

type TurnStreamOptions = {
	uiMessages: UIMessage[];
	originalMessages: UIMessage<ChatMessageMetadata>[];
	abortSignal: AbortSignal | undefined;
	maxSteps: number;
	promptTokens: number | undefined;
	replyId: ChatMessageId;
	onStepEnd: (step: MeterStep) => Promise<void>;
	onEnd: (event: {
		responseMessage: UIMessage<StreamedMetadata>;
		outcome: UIMessageStreamOutcome;
	}) => Promise<void>;
	onError: (error: unknown) => string;
	messageMetadata: (
		part: TextStreamPart<ToolSet>,
	) => StreamedMetadata | undefined;
};

/**
 * Replaces tool executions and keeps each tool's declaration: description,
 * schema, model output and provider options. The evals script them with it.
 */
export type ToolExecutions = <TOOLS extends ToolSet>(tools: TOOLS) => TOOLS;

/** What one request did, read from its steps. */
type TurnRun = {
	steps: StepResult<ToolSet>[];
	/** The last step's text. */
	text: string;
	/** The request's messages, for a next request to go on from. */
	responseMessages: ModelMessage[];
};

/** An agent of either chat kind, streamed the same way. */
export type TurnAgent = {
	/** Every tool its stored calls may name. */
	tools: ToolSet;
	/** The chat's sources, which its calls add to as they finish. */
	sources: ChatSources;
	/** The tools its requests may send this turn. */
	offeredTools: () => ToolSet;
	instructions: SystemModelMessage[];
	/** Whether the turn stopped because its next step would not fit. */
	contextFull: () => boolean;
	stream: (
		options: TurnStreamOptions,
	) => Promise<AsyncIterableStream<UIMessageChunk>>;
	/** Runs one request on model messages to its end, steps as the stream takes them. */
	generate: (options: {
		messages: ModelMessage[];
		maxSteps: number;
	}) => Promise<TurnRun>;
};

export type TurnTelemetryIds = {
	organizationId: string;
	chatId: string;
	providerId: string;
	modelId: string;
};

/**
 * The agent of a turn, chat or Assistant. Every step is shaped by the step
 * shaper with the agent's pruning, sends only the active tools in the order
 * `tools` declares them, and repairs malformed repository calls. The step cap
 * comes with each stream, as the quota leaves it.
 */
export const createTurnAgent = (params: {
	model: AgentModel;
	/** The telemetry function id. */
	functionId: "chat.agent" | "assistant.agent";
	telemetryIds: TurnTelemetryIds;
	instructions: SystemModelMessage[];
	/** Every tool a stored call may name, in the order requests send them. */
	tools: ToolSet;
	/** The tools the next step sends; none sends no tools at all. */
	activeTools: () => string[];
	/** The most the turn's requests may send, which its estimate reserves. */
	offeredTools: () => ToolSet;
	/** Calls that wait for the user's approval. */
	toolApproval?: ToolLoopAgentSettings<never, ToolSet>["toolApproval"];
	prune: (messages: ModelMessage[]) => ModelMessage[];
	callSettings: ChatCallSettings;
	compaction: ProviderCompaction;
	sources: ChatSources;
	/** Sees every tool result, also of calls approved in an earlier request, which run before the first step. */
	onToolResult?: (result: {
		toolCallId: string;
		toolName: string;
		input: unknown;
		output: unknown;
	}) => void;
}): TurnAgent => {
	const steps = createStepShaper({
		prune: params.prune,
	});
	const agent = new ToolLoopAgent({
		model: params.model.language,
		tools: params.tools,
		toolApproval: params.toolApproval,
		...aiTelemetry(params.functionId, params.telemetryIds),
		repairToolCall: repairRepositoryToolCall,
		callOptionsSchema: stepBudgetOptionsSchema,
		prepareCall: ({ options, ...settings }) => {
			const turn = steps.forTurn(options);
			return {
				...settings,
				...params.callSettings,
				providerOptions: params.compaction.providerOptions,
				instructions: params.instructions,
				stopWhen: turn.stopWhen,
				prepareStep: (step) => ({
					...turn.prepareStep(step),
					activeTools: params.activeTools(),
				}),
			};
		},
		onToolExecutionEnd: ({ toolOutput }) => {
			steps.recordExecution(toolOutput);
			if (toolOutput.type === "tool-result") {
				params.onToolResult?.(toolOutput);
				params.sources.record(toolOutput.toolName, toolOutput.output);
			}
		},
		output: Output.text(),
	});

	return {
		tools: agent.tools,
		sources: params.sources,
		offeredTools: params.offeredTools,
		instructions: params.instructions,
		contextFull: steps.contextFull,
		stream: (options) =>
			createAgentUIStream({
				agent,
				uiMessages: options.uiMessages,
				// Each chat kind stores only its own agent's tool parts.
				originalMessages: options.originalMessages as InferAgentUIMessage<
					typeof agent,
					StreamedMetadata
				>[],
				abortSignal: options.abortSignal,
				options: {
					maxSteps: options.maxSteps,
					promptTokens: options.promptTokens,
				},
				generateMessageId: () => options.replyId,
				experimental_transform: [
					lastStepToolCalls(),
					smoothStream({
						delayInMs: 20,
						chunking: "word",
					}),
				],
				onStepEnd: options.onStepEnd,
				onEnd: options.onEnd,
				onError: options.onError,
				messageMetadata: ({ part }) => options.messageMetadata(part),
			}),
		generate: async ({ messages, maxSteps }) => {
			const result = await agent.stream({
				messages,
				options: {
					maxSteps,
				},
				experimental_transform: lastStepToolCalls(),
			});
			for await (const part of result.fullStream) {
				if (part.type === "error") {
					throw part.error;
				}
			}
			return {
				steps: await result.steps,
				text: await result.text,
				responseMessages: (await result.response).messages,
			};
		},
	};
};
