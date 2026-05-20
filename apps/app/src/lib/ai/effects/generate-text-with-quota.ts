import { AiError, BadRequestError } from "@orcai/ai";
import type { OrganizationId, ProviderId, UserId } from "@orcai/core";
import {
	finalizeAppRequestQuota,
	releaseAppRequestQuota,
	reserveForAppRequest,
} from "@orcai/quota";
import { generateText, type LanguageModel, type ModelMessage } from "ai";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

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
	isFirstTurn: boolean;
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

export const generateTextWithQuota = (input: GenerateTextWithQuotaInput) =>
	Effect.gen(function* () {
		const messages = input.messages ?? [];

		if (messages.length === 0 && !input.prompt) {
			return yield* new BadRequestError({
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
			isFirstTurn: input.isFirstTurn,
		});

		if (!reservation.allowed || !reservation.reservation) {
			const denialReason = reservation.denialReason ?? "error";
			return yield* new BadRequestError({
				message:
					denialReason === "no_pool"
						? "No quota pool available for this request."
						: denialReason === "exhausted"
							? "Quota exhausted for this provider/model."
							: "Quota check failed.",
			});
		}

		const baseInput = {
			model: input.model,
			system: input.system,
			maxOutputTokens: input.maxOutputTokens,
			temperature: input.temperature,
			topP: input.topP,
			frequencyPenalty: input.frequencyPenalty,
			presencePenalty: input.presencePenalty,
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
