import { AiError, aiTelemetry } from "@orcai/ai";
import type { OrganizationId, ProviderId, UserId } from "@orcai/core";
import { generateText, type LanguageModel, type ModelMessage } from "ai";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { startMeteredCall } from "@/lib/ai/metered-call/metered-call";
import { BadRequestError } from "@/lib/effect/utils/errors";

export interface GenerateTextWithQuotaInput {
	operation: string;
	appRequestId: string;
	organizationId: OrganizationId;
	userId: UserId;
	providerId: ProviderId;
	providerModelId: string | null;
	model: LanguageModel;
	messages?: ModelMessage[];
	reservationMessages?: unknown[];
	system?: string;
	prompt?: string;
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

export const generateTextWithQuota = (input: GenerateTextWithQuotaInput) =>
	Effect.gen(function* () {
		const messages = input.messages ?? [];

		if (messages.length === 0 && !input.prompt) {
			return yield* new BadRequestError({
				reason: "AI_PROMPT_REQUIRED",
				message: "Either messages or prompt is required for text generation.",
			});
		}

		const meter = yield* startMeteredCall({
			organizationId: input.organizationId,
			userId: input.userId,
			providerId: input.providerId,
			providerModelId: input.providerModelId,
			appRequestId: input.appRequestId,
			maxOutputTokens: input.maxOutputTokens,
			maxSteps: input.maxExpectedProviderRequests ?? 1,
			messages: input.reservationMessages ?? messages,
		});

		const baseInput = {
			model: input.model,
			instructions: input.system,
			maxOutputTokens: input.maxOutputTokens,
			reasoning: input.reasoning,
			temperature: input.temperature,
			topP: input.topP,
			frequencyPenalty: input.frequencyPenalty,
			presencePenalty: input.presencePenalty,
			abortSignal: input.abortSignal,
			...aiTelemetry(input.operation, {
				organizationId: input.organizationId,
				providerId: input.providerId,
			}),
		};

		const providerCallBase = Effect.tryPromise({
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

		const providerCall =
			input.timeoutMs === undefined
				? providerCallBase
				: providerCallBase.pipe(
						Effect.timeout(input.timeoutMs),
						Effect.catchTag("TimeoutError", () =>
							Effect.fail(
								new AiError({
									operation: input.operation,
									cause: new Error(
										`Text generation timed out after ${input.timeoutMs}ms`,
									),
								}),
							),
						),
					);

		const response = yield* providerCall.pipe(
			Effect.tap((response) =>
				Effect.sync(() => {
					for (const step of response.steps) {
						meter.step(step.usage);
					}
				}),
			),
			Effect.onExit((exit) =>
				meter.settle(Exit.isSuccess(exit) ? "completed" : "failed"),
			),
		);

		return {
			text: response.text,
			usage: response.usage,
		};
	});
