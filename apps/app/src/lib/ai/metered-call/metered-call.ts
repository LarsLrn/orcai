import type { BotId, OrganizationId, ProviderId, UserId } from "@orcai/core";
import type { DB } from "@orcai/db";
import {
	finalizeAppRequestQuota,
	type QuotaCounterStore,
	releaseAppRequestQuota,
	reserveForAppRequest,
} from "@orcai/quota";
import type { LanguageModelUsage } from "ai";
import * as Effect from "effect/Effect";
import { BadRequestError } from "@/lib/effect/utils/errors";

export type MeteredCallOutcome = "completed" | "aborted" | "failed" | "unused";

export interface Meter {
	/** Provider requests the pool granted: fewer than asked when a request quota has less left. */
	readonly maxSteps: number;
	/** Accounts one finished provider request and its usage. */
	readonly step: (usage: LanguageModelUsage) => void;
	/** Whether the granted requests are used up. */
	readonly spent: () => boolean;
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

const addTokens = (sum: number | undefined, tokens: number | undefined) =>
	tokens === undefined ? sum : (sum ?? 0) + tokens;

export const startMeteredCall = (input: {
	appRequestId: string;
	organizationId: OrganizationId;
	userId: UserId;
	providerId: ProviderId;
	providerModelId: string | null;
	/** The bot whose chat the call runs in. */
	botId?: BotId | null;
	/** Provider requests the call may make at most. */
	maxSteps: number;
	maxOutputTokens?: number;
	/** What the call sends, for the token estimate. */
	messages: unknown[];
}): Effect.Effect<Meter, unknown, QuotaCounterStore | DB> =>
	Effect.gen(function* () {
		const result = yield* reserveForAppRequest({
			organizationId: input.organizationId,
			userId: input.userId,
			providerId: input.providerId,
			providerModelId: input.providerModelId,
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

		const services = yield* Effect.context<QuotaCounterStore | DB>();
		const maxSteps =
			reservation.meteringMode === "requests"
				? reservation.reservedAmount
				: input.maxSteps;
		let steps = 0;
		let inputTokens: number | undefined;
		let outputTokens: number | undefined;
		let totalTokens: number | undefined;
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
				actualRequestCount: steps,
				inputTokens,
				outputTokens,
				totalTokens,
			}),
		).pipe(Effect.catch(logFailure("quota.finalize.failed")));

		const release = (reason: "provider_failure" | "app_failure") =>
			releaseAppRequestQuota({
				reservation,
				reason,
			}).pipe(Effect.catch(logFailure("quota.release.failed")));

		return {
			maxSteps,
			step: (usage) => {
				steps += 1;
				inputTokens = addTokens(inputTokens, usage.inputTokens);
				outputTokens = addTokens(outputTokens, usage.outputTokens);
				totalTokens = addTokens(totalTokens, usage.totalTokens);
			},
			spent: () => steps >= maxSteps,
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
