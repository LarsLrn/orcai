import { NATIVE_WEB_SEARCH_TOOL_NAME } from "@orcai/ai";
import type { BotId, OrganizationId, ProviderId, UserId } from "@orcai/core";
import type { DB } from "@orcai/db";
import {
	finalizeAppRequestQuota,
	METERED_CALL_TIMEOUT_MS,
	type MeteredStep,
	releaseAppRequestQuota,
	reserveForAppRequest,
} from "@orcai/quota";
import type { StepResult, ToolSet } from "ai";
import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { BadRequestError } from "@/lib/effect/utils/errors";

export type MeteredCallOutcome = "completed" | "aborted" | "failed" | "unused";

/** What the meter reads of a finished provider request. */
export type MeterStep = Pick<StepResult<ToolSet>, "usage" | "toolCalls">;

export interface Meter {
	/** Provider requests the pool granted: fewer than asked when a request quota has less left. */
	readonly maxSteps: number;
	/** Accounts one finished provider request and its usage. */
	readonly step: (step: MeterStep) => void;
	/** Whether the granted requests are used up. */
	readonly spent: () => boolean;
	/** Aborts once the call has run as long as its reservation may stay open. */
	readonly deadline: AbortSignal;
	/**
	 * Charges completed and aborted calls what their finished steps used and
	 * releases the reservation of failed and unused ones. Runs once and never
	 * fails: a quota error is logged.
	 */
	readonly settle: (outcome: MeteredCallOutcome) => Effect.Effect<void>;
}

const denialError = (
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

/** What the meter reads of a provider's own usage report. */
const rawUsageSchema = z
	.object({
		server_tool_use: z
			.object({
				web_search_requests: z.number(),
			})
			.optional()
			.catch(undefined),
	})
	.catch({});

/** Anthropic counts native searches in its usage; OpenAI only returns their calls. */
const webSearches = ({ usage, toolCalls }: MeterStep) =>
	rawUsageSchema.parse(usage.raw).server_tool_use?.web_search_requests ??
	toolCalls.filter(
		(call) =>
			call.providerExecuted === true &&
			call.toolName === NATIVE_WEB_SEARCH_TOOL_NAME,
	).length;

const meteredStep = (step: MeterStep): MeteredStep => ({
	inputTokens: step.usage.inputTokens,
	noCacheInputTokens: step.usage.inputTokenDetails.noCacheTokens,
	cacheReadTokens: step.usage.inputTokenDetails.cacheReadTokens,
	cacheWriteTokens: step.usage.inputTokenDetails.cacheWriteTokens,
	outputTokens: step.usage.outputTokens,
	reasoningTokens: step.usage.outputTokenDetails.reasoningTokens,
	totalTokens: step.usage.totalTokens,
	webSearches: webSearches(step),
});

export const startMeteredCall = (input: {
	appRequestId: string;
	organizationId: OrganizationId;
	userId: UserId;
	providerId: ProviderId;
	modelId: string | null;
	/** The bot whose chat the call runs in. */
	botId?: BotId | null;
	/** Provider requests the call may make at most. */
	maxSteps: number;
	maxOutputTokens?: number;
	/** What the call sends, for the token estimate. */
	messages: unknown[];
}): Effect.Effect<Meter, unknown, DB> =>
	Effect.gen(function* () {
		const result = yield* reserveForAppRequest({
			organizationId: input.organizationId,
			userId: input.userId,
			providerId: input.providerId,
			modelId: input.modelId,
			botId: input.botId,
			appRequestId: input.appRequestId,
			maxExpectedOutputTokens: input.maxOutputTokens,
			maxExpectedProviderRequests: input.maxSteps,
			messages: input.messages,
		});
		const reservation = result.reservation;

		if (!result.allowed || reservation === undefined) {
			return yield* denialError(result.denialReason);
		}

		const deadline = AbortSignal.timeout(METERED_CALL_TIMEOUT_MS);
		const services = yield* Effect.context<DB>();
		const maxSteps =
			reservation.meteringMode === "requests"
				? reservation.reservedAmount
				: input.maxSteps;
		const steps: MeteredStep[] = [];
		let settled = false;

		const logFailure = (message: string) => (error: unknown) =>
			Effect.logError({
				appRequestId: reservation.appRequestId,
				error: error instanceof Error ? error.message : String(error),
				message,
				reservationKey: reservation.reservationKey,
			});

		const charge = Effect.suspend(() =>
			finalizeAppRequestQuota({
				reservation,
				steps,
			}),
		).pipe(Effect.catch(logFailure("quota.finalize.failed")));

		const release = (reason: "provider_failure" | "app_failure") =>
			releaseAppRequestQuota({
				reservation,
				reason,
			}).pipe(Effect.catch(logFailure("quota.release.failed")));

		return {
			maxSteps,
			step: (step) => {
				steps.push(meteredStep(step));
			},
			spent: () => steps.length >= maxSteps,
			deadline,
			settle: (outcome) =>
				Effect.suspend(() => {
					if (settled) {
						return Effect.void;
					}
					settled = true;

					switch (outcome) {
						case "completed":
						case "aborted":
							return charge;
						case "failed":
							return release("provider_failure");
						case "unused":
							return release("app_failure");
					}
				}).pipe(Effect.provideContext(services)),
		} satisfies Meter;
	});
