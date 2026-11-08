import type { WebSearch, WebSearchQuery, WebSearchResult } from "@orcai/ai";
import type { BotId, OrganizationId, ProviderId, UserId } from "@orcai/core";
import { meteredCall, type QuotaReservations } from "@orcai/quota";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { v4 as uuidv4 } from "uuid";
import { AssistantToolError } from "@/lib/ai/tools/tool-error";

/** One search as the turn runs it; fails with the text the model reads. */
export type MeteredWebSearch = (
	query: WebSearchQuery,
	signal?: AbortSignal,
) => Effect.Effect<WebSearchResult[], AssistantToolError, QuotaReservations>;

const DENIALS = {
	QUOTA_POOL_UNAVAILABLE:
		"QUOTA_POOL_UNAVAILABLE: No quota pool of the search provider covers this user. Tell the user web search is unavailable and answer without it.",
	QUOTA_EXHAUSTED:
		"QUOTA_EXHAUSTED: The search provider's quota is used up. Tell the user web search is unavailable for now and answer without it.",
	QUOTA_CHECK_FAILED:
		"QUOTA_CHECK_FAILED: The quota of the search provider could not be checked.",
} as const;

/**
 * Each search reserves one request on the provider's quota pool and is
 * charged once it answered, also with no results; a failed or cancelled
 * search gives it back. A denied reservation fails before the provider is
 * called.
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
		meteredCall(
			{
				organizationId,
				userId,
				botId,
				providerId,
				modelId: null,
				appRequestId: `web-search:${uuidv4()}`,
				maxRequests: 1,
				inputTokens: 0,
			},
			(call) =>
				Effect.tryPromise({
					try: () =>
						search(query, {
							signal: AbortSignal.any([
								...(signal
									? [
											signal,
										]
									: []),
								call.deadline,
							]),
						}),
					catch: (cause) =>
						new AssistantToolError(
							`WEB_SEARCH_FAILED: ${cause instanceof Error ? cause.message : "The search provider failed."}`,
						),
				}).pipe(
					// One search request, which uses no tokens.
					Effect.tap(() => call.record({})),
				),
			(exit) =>
				Exit.isSuccess(exit)
					? "completed"
					: Exit.hasInterrupts(exit) || signal?.aborted
						? "cancelled"
						: "failed",
		).pipe(
			Effect.catchTags({
				QuotaDeniedError: (denied) =>
					Effect.fail(new AssistantToolError(DENIALS[denied.reason])),
				QuotaUnavailableError: (unavailable) =>
					Effect.logError({
						message: "quota.web_search.unavailable",
						error: String(unavailable.cause),
					}).pipe(
						Effect.andThen(
							Effect.fail(new AssistantToolError(DENIALS.QUOTA_CHECK_FAILED)),
						),
					),
			}),
		);
