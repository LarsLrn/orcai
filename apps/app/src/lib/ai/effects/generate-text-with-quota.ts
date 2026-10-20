import { AiError, aiTelemetry } from "@orcai/ai";
import type { OrganizationId, ProviderId, UserId } from "@orcai/core";
import {
	finalizeAppRequestQuota,
	releaseAppRequestQuota,
	reserveForAppRequest,
} from "@orcai/quota";
import { generateText, type LanguageModel, type ModelMessage } from "ai";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
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
	temperature?: number;
	topP?: number;
	frequencyPenalty?: number;
	presencePenalty?: number;
	timeoutMs?: number;
	maxExpectedProviderRequests?: number;
}

export const quotaDenialError = (
	denialReason: "no_pool" | "exhausted" | "error" | undefined,
) => {
	switch (denialReason) {
		case "no_pool":
			return new BadRequestError({
				reason: "QUOTA_POOL_UNAVAILABLE",
				message: "No quota pool available for this request.",
			});
		case "exhausted":
			return new BadRequestError({
				reason: "QUOTA_EXHAUSTED",
				message: "Quota exhausted for this provider/model.",
			});
		default:
			return new BadRequestError({
				reason: "QUOTA_CHECK_FAILED",
				message: "Quota check failed.",
			});
	}
};

export const generateTextWithQuota = (input: GenerateTextWithQuotaInput) =>
	Effect.gen(function* () {
		const messages = input.messages ?? [];

		if (messages.length === 0 && !input.prompt) {
			return yield* new BadRequestError({
				reason: "AI_PROMPT_REQUIRED",
				message: "Either messages or prompt is required for text generation.",
			});
		}

		const reservation = yield* reserveForAppRequest({
			organizationId: input.organizationId,
			userId: input.userId,
			providerId: input.providerId,
			providerModelId: input.providerModelId,
			appRequestId: input.appRequestId,
			maxExpectedOutputTokens: input.maxOutputTokens,
			maxExpectedProviderRequests: input.maxExpectedProviderRequests ?? 1,
			messages: input.reservationMessages ?? messages,
		});

		if (!reservation.allowed || !reservation.reservation) {
			return yield* quotaDenialError(reservation.denialReason);
		}

		const baseInput = {
			model: input.model,
			instructions: input.system,
			maxOutputTokens: input.maxOutputTokens,
			temperature: input.temperature,
			topP: input.topP,
			frequencyPenalty: input.frequencyPenalty,
			presencePenalty: input.presencePenalty,
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

		const providerExit = yield* Effect.exit(providerCall);

		if (Exit.isFailure(providerExit)) {
			yield* releaseAppRequestQuota({
				reservation: reservation.reservation,
				reason: "provider_failure",
			}).pipe(Effect.catch(() => Effect.void));

			return yield* Effect.failCause(providerExit.cause);
		}

		const response = providerExit.value;

		yield* finalizeAppRequestQuota({
			reservation: reservation.reservation,
			actualRequestCount: 1,
			inputTokens: response.usage.inputTokens,
			outputTokens: response.usage.outputTokens,
			totalTokens: response.usage.totalTokens,
		});

		return {
			text: response.text,
			usage: response.usage,
		};
	});
