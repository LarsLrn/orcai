import type { WebSearch, WebSearchQuery, WebSearchResult } from "@orcai/ai";
import type { BotId, OrganizationId, ProviderId, UserId } from "@orcai/core";
import type { DB } from "@orcai/db";
import {
	finalizeAppRequestQuota,
	METERED_CALL_TIMEOUT_MS,
	releaseAppRequestQuota,
	reserveForAppRequest,
} from "@orcai/quota";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { v4 as uuidv4 } from "uuid";
import { AssistantToolError } from "@/lib/ai/tools/tool-error";

/** One search as the turn runs it; fails with the text the model reads. */
export type MeteredWebSearch = (
	query: WebSearchQuery,
	signal?: AbortSignal,
) => Effect.Effect<WebSearchResult[], AssistantToolError, DB>;

const DENIALS = {
	no_pool:
		"QUOTA_POOL_UNAVAILABLE: No quota pool of the search provider covers this user. Tell the user web search is unavailable and answer without it.",
	exhausted:
		"QUOTA_EXHAUSTED: The search provider's quota is used up. Tell the user web search is unavailable for now and answer without it.",
	error:
		"QUOTA_CHECK_FAILED: The quota of the search provider could not be checked.",
} as const;

const logFailure = (message: string) => (error: unknown) =>
	Effect.logError({
		error: error instanceof Error ? error.message : String(error),
		message,
	});

/**
 * Each search reserves one request on the provider's quota pool and is
 * charged once it answered; a failed or cancelled search gives it back. A
 * denied reservation fails before the provider is called.
 */
export const meteredWebSearch =
	({
		organizationId,
		userId,
		botId,
		providerId,
		search,
	}: {
		organizationId: OrganizationId;
		userId: UserId;
		botId: BotId;
		providerId: ProviderId;
		search: WebSearch;
	}): MeteredWebSearch =>
	(query, signal) =>
		Effect.gen(function* () {
			const result = yield* reserveForAppRequest({
				organizationId,
				userId,
				botId,
				providerId,
				modelId: null,
				appRequestId: `web-search:${uuidv4()}`,
				maxExpectedProviderRequests: 1,
				messages: [],
			}).pipe(Effect.mapError(() => new AssistantToolError(DENIALS.error)));
			const { reservation } = result;
			if (!result.allowed || reservation === undefined) {
				return yield* Effect.fail(
					new AssistantToolError(DENIALS[result.denialReason ?? "error"]),
				);
			}

			return yield* Effect.tryPromise({
				try: () =>
					search(query, {
						signal: AbortSignal.any([
							...(signal
								? [
										signal,
									]
								: []),
							AbortSignal.timeout(METERED_CALL_TIMEOUT_MS),
						]),
					}),
				catch: (cause) =>
					new AssistantToolError(
						`WEB_SEARCH_FAILED: ${cause instanceof Error ? cause.message : "The search provider failed."}`,
					),
			}).pipe(
				Effect.onExit((exit) =>
					(Exit.isSuccess(exit)
						? finalizeAppRequestQuota({
								reservation,
								actualRequestCount: 1,
							})
						: releaseAppRequestQuota({
								reservation,
								reason: Exit.hasInterrupts(exit)
									? "cancelled"
									: "provider_failure",
							})
					).pipe(Effect.catch(logFailure("quota.web_search.settle_failed"))),
				),
			);
		});
