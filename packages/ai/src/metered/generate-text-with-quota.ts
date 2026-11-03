import type {
	BotId,
	ModelId,
	OrganizationId,
	ProviderId,
	UserId,
} from "@orcai/core";
import { meteredCall, promptTokens } from "@orcai/quota";
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
import { meteredStep } from "./metered-step";

interface GenerateTextWithQuotaInput<
	OUTPUT extends OutputInterface = OutputInterface<string, string>,
> {
	operation: string;
	appRequestId: string;
	organizationId: OrganizationId;
	userId: UserId;
	providerId: ProviderId;
	modelId: ModelId | null;
	botId?: BotId | null;
	model: LanguageModel;
	messages?: ModelMessage[];
	system?: string;
	prompt?: string;
	/** Structured output; a reply that does not match is charged and fails. */
	output?: OUTPUT;
	maxOutputTokens?: number;
	reasoning?: Parameters<typeof generateText>[0]["reasoning"];
	timeoutMs?: number;
	abortSignal?: AbortSignal;
}

/**
 * One generation metered against the quota of the organisation and user. Each
 * finished step is charged, also when the call fails or is stopped after it.
 */
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

		return yield* meteredCall(
			{
				organizationId: input.organizationId,
				userId: input.userId,
				providerId: input.providerId,
				modelId: input.modelId,
				botId: input.botId,
				appRequestId: input.appRequestId,
				maxOutputTokens: input.maxOutputTokens,
				maxRequests: 1,
				inputTokens: promptTokens([
					...(input.system === undefined
						? []
						: [
								input.system,
							]),
					...(input.prompt
						? [
								input.prompt,
							]
						: messages),
				]),
			},
			(call) =>
				Effect.gen(function* () {
					const baseInput = {
						model: input.output ? jsonAnswerModel(input.model) : input.model,
						instructions: input.system,
						output: input.output,
						maxOutputTokens: input.maxOutputTokens,
						reasoning: input.reasoning,
						abortSignal: AbortSignal.any([
							...(input.abortSignal
								? [
										input.abortSignal,
									]
								: []),
							call.deadline,
						]),
						...(input.timeoutMs !== undefined && {
							timeout: {
								totalMs: input.timeoutMs,
							},
						}),
						onStepEnd: (step: Parameters<typeof meteredStep>[0]) =>
							Effect.runPromise(call.record(meteredStep(step))),
						...aiTelemetry(input.operation, {
							organizationId: input.organizationId,
							providerId: input.providerId,
						}),
					};

					const response = yield* Effect.tryPromise({
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
						catch: (cause) =>
							new AiError({
								operation: input.operation,
								cause,
							}),
					});

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
				}),
			(exit) =>
				Exit.isSuccess(exit)
					? "completed"
					: Exit.hasInterrupts(exit) || input.abortSignal?.aborted
						? "cancelled"
						: "failed",
		);
	});
