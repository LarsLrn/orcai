import type { BotId, OrganizationId, ProviderId, UserId } from "@orcai/core";
import {
	generateText,
	type InferGenerateOutput,
	type LanguageModel,
	type ModelMessage,
	NoObjectGeneratedError,
	NoOutputGeneratedError,
	type OutputInterface,
} from "ai";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { AiError } from "../errors";
import { jsonAnswerModel } from "../json-answer";
import { aiTelemetry } from "../telemetry";
import { startMeteredCall } from "./meter";

interface GenerateTextWithQuotaInput<
	OUTPUT extends OutputInterface = OutputInterface<string, string>,
> {
	operation: string;
	appRequestId: string;
	organizationId: OrganizationId;
	userId: UserId;
	providerId: ProviderId;
	modelId: string | null;
	botId?: BotId | null;
	model: LanguageModel;
	messages?: ModelMessage[];
	reservationMessages?: unknown[];
	system?: string;
	prompt?: string;
	/** Structured output; a reply that does not match is charged and fails. */
	output?: OUTPUT;
	maxOutputTokens?: number;
	reasoning?: Parameters<typeof generateText>[0]["reasoning"];
	temperature?: number;
	topP?: number;
	frequencyPenalty?: number;
	presencePenalty?: number;
	timeoutMs?: number;
	abortSignal?: AbortSignal;
	maxExpectedProviderRequests?: number;
}

/** One generation metered against the quota of the organisation and user. */
export const generateTextWithQuota = <
	OUTPUT extends OutputInterface = OutputInterface<string, string>,
>(
	input: GenerateTextWithQuotaInput<OUTPUT>,
) =>
	Effect.gen(function* () {
		const messages = input.messages ?? [];

		if (messages.length === 0 && !input.prompt) {
			return yield* new AiError({
				operation: input.operation,
				cause: new Error("Either messages or prompt is required."),
			});
		}

		const meter = yield* startMeteredCall({
			organizationId: input.organizationId,
			userId: input.userId,
			providerId: input.providerId,
			modelId: input.modelId,
			botId: input.botId,
			appRequestId: input.appRequestId,
			maxOutputTokens: input.maxOutputTokens,
			maxSteps: input.maxExpectedProviderRequests ?? 1,
			messages: input.reservationMessages ?? messages,
		});

		const baseInput = {
			model: input.output ? jsonAnswerModel(input.model) : input.model,
			instructions: input.system,
			output: input.output,
			maxOutputTokens: input.maxOutputTokens,
			reasoning: input.reasoning,
			temperature: input.temperature,
			topP: input.topP,
			frequencyPenalty: input.frequencyPenalty,
			presencePenalty: input.presencePenalty,
			abortSignal: AbortSignal.any([
				...(input.abortSignal
					? [
							input.abortSignal,
						]
					: []),
				meter.deadline,
			]),
			...(input.timeoutMs !== undefined && {
				timeout: {
					totalMs: input.timeoutMs,
				},
			}),
			...aiTelemetry(input.operation, {
				organizationId: input.organizationId,
				providerId: input.providerId,
			}),
		};

		let answered = false;
		const providerCall = Effect.tryPromise({
			try: () =>
				input.prompt
					? generateText({
							...baseInput,
							prompt: input.prompt,
						})
					: generateText({
							...baseInput,
							messages,
						}),
			catch: (cause) => {
				// The provider answered, so the reply is charged even though it does not parse.
				if (NoObjectGeneratedError.isInstance(cause) && cause.usage) {
					answered = true;
					meter.step({
						usage: cause.usage,
						toolCalls: [],
					});
				}
				return new AiError({
					operation: input.operation,
					cause,
				});
			},
		});

		const response = yield* providerCall.pipe(
			Effect.tap((response) =>
				Effect.sync(() => {
					for (const step of response.steps) {
						meter.step(step);
					}
				}),
			),
			Effect.onExit((exit) =>
				meter.settle(Exit.isSuccess(exit) || answered ? "completed" : "failed"),
			),
		);

		// The SDK reads the output lazily: a reply cut off before any text throws here, charged already.
		return yield* Effect.try({
			try: () => ({
				text: response.text,
				output: response.output as InferGenerateOutput<OUTPUT>,
				usage: response.usage,
			}),
			catch: (cause) =>
				new AiError({
					operation: input.operation,
					cause: NoOutputGeneratedError.isInstance(cause)
						? new NoObjectGeneratedError({
								message: `No output generated: the reply finished with "${response.finishReason}".`,
								cause,
								text: response.text,
								response: response.response,
								usage: response.usage,
								finishReason: response.finishReason,
							})
						: cause,
				}),
		});
	});
