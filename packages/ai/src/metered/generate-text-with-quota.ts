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
	NoObjectGeneratedError,
	NoOutputGeneratedError,
	type OutputInterface,
} from "ai";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { type CallSpec, callRequest } from "../call-spec";
import { AiError } from "../errors";
import { aiTelemetry } from "../telemetry";
import { meteredStep } from "./metered-step";

interface GenerateTextWithQuotaInput<OUTPUT extends OutputInterface> {
	appRequestId: string;
	organizationId: OrganizationId;
	userId: UserId;
	providerId: ProviderId;
	modelId: ModelId | null;
	botId?: BotId | null;
	model: LanguageModel;
	call: CallSpec<OUTPUT>;
	abortSignal?: AbortSignal;
	/** Runs past the pool's budget instead of being refused; still recorded. */
	allowOverBudget?: boolean;
}

/**
 * One call metered against the quota of the organisation and user. Each
 * finished step is charged, also when the call fails or is stopped after it.
 * A structured reply that does not match is charged and fails.
 */
export const generateTextWithQuota = <
	OUTPUT extends OutputInterface = OutputInterface<string, string>,
>(
	input: GenerateTextWithQuotaInput<OUTPUT>,
) => {
	const { call } = input;
	return meteredCall(
		{
			organizationId: input.organizationId,
			userId: input.userId,
			providerId: input.providerId,
			modelId: input.modelId,
			botId: input.botId,
			appRequestId: input.appRequestId,
			maxOutputTokens: call.maxOutputTokens,
			maxRequests: 1,
			allowOverBudget: input.allowOverBudget,
			inputTokens: promptTokens([
				call.instructions,
				...(typeof call.prompt === "string"
					? [
							call.prompt,
						]
					: call.prompt),
			]),
		},
		(metered) =>
			Effect.gen(function* () {
				const response = yield* Effect.tryPromise({
					try: () =>
						generateText({
							...callRequest(input.model, call),
							abortSignal: AbortSignal.any([
								...(input.abortSignal
									? [
											input.abortSignal,
										]
									: []),
								metered.deadline,
							]),
							onStepEnd: (step) =>
								Effect.runPromise(metered.record(meteredStep(step))),
							...aiTelemetry(call.operation, {
								organizationId: input.organizationId,
								providerId: input.providerId,
							}),
						}),
					catch: (cause) =>
						new AiError({
							operation: call.operation,
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
							operation: call.operation,
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
};
