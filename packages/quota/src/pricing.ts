import type { ModelId, ProviderId } from "@orcai/core";
import { DB, dbSchema } from "@orcai/db";
import { and, eq } from "drizzle-orm";
import * as Effect from "effect/Effect";
import type { MeteredStep } from "./usage";

type UsageEvent = typeof dbSchema.quotaUsageEvent.$inferSelect;

/** What a provider bills for a call, in its currency; a price is null when unset. */
export interface PriceList {
	currency: string;
	/** The provider reports each request's cost in USD. */
	reportsCost: boolean;
	/** The model's prices: tokens per 1M, then per request and per native web search. */
	model: {
		input: number | null;
		cacheRead: number | null;
		cacheWrite: number | null;
		output: number | null;
		request: number | null;
		webSearch: number | null;
	} | null;
	/** A search provider's price per search. */
	search: number | null;
}

export type EventCost = Pick<UsageEvent, "cost" | "currency" | "costSource">;

const MICRO = 1_000_000;

const UNPRICED: EventCost = {
	cost: null,
	currency: null,
	costSource: null,
};

/** A model needs input and output prices; a search provider its price per search. */
const isPriced = ({ model, search }: PriceList) =>
	model === null
		? search !== null
		: model.input !== null && model.output !== null;

/** One request's cost in micro-units from a priced list. */
const estimate = ({ model, search }: PriceList, step: MeteredStep) => {
	if (model === null) {
		return (search ?? 0) * MICRO;
	}
	const input = model.input ?? 0;
	const cacheRead = step.cacheReadTokens ?? 0;
	const cacheWrite = step.cacheWriteTokens ?? 0;
	const noCache =
		step.noCacheInputTokens ??
		Math.max(0, (step.inputTokens ?? 0) - cacheRead - cacheWrite);
	// A price per 1M tokens times tokens is micro-units.
	return (
		noCache * input +
		cacheRead * (model.cacheRead ?? input) +
		cacheWrite * (model.cacheWrite ?? input) +
		(step.outputTokens ?? 0) * (model.output ?? 0) +
		((model.request ?? 0) + (step.webSearches ?? 0) * (model.webSearch ?? 0)) *
			MICRO
	);
};

/**
 * A call's cost in micro-units of the provider's currency, rounded once. Each
 * step costs what the provider reported or else what the prices give; the
 * cost is reported only when every step reported one, and unknown when a step
 * needs prices that are not set or there are no prices at all.
 */
export const priceSteps = (
	steps: readonly MeteredStep[],
	prices: PriceList | null,
): EventCost => {
	if (prices === null) {
		return UNPRICED;
	}
	const reported = (step: MeteredStep) =>
		prices.reportsCost ? step.reportedCost : undefined;
	const allReported =
		steps.length > 0 && steps.every((step) => reported(step) !== undefined);
	if (!allReported && !isPriced(prices)) {
		return UNPRICED;
	}

	const cost = steps.reduce((sum, step) => {
		const reportedCost = reported(step);
		return (
			sum +
			(reportedCost === undefined
				? estimate(prices, step)
				: reportedCost * MICRO)
		);
	}, 0);
	return {
		cost: Math.round(cost),
		currency: prices.currency,
		costSource: allReported ? "reported" : "estimated",
	};
};

/** The prices in force for a call on the provider and model; null without the provider. */
export const loadPriceList = (params: {
	providerId: ProviderId;
	modelId: string | null;
}): Effect.Effect<PriceList | null, unknown, DB> =>
	Effect.gen(function* () {
		const db = yield* DB;
		const { provider, model } = dbSchema;
		const [providerRow] = yield* db
			.select({
				currency: provider.currency,
				reportsCost: provider.reportsCost,
				search: provider.searchPrice,
			})
			.from(provider)
			.where(eq(provider.id, params.providerId))
			.limit(1);
		if (!providerRow) {
			return null;
		}

		const [modelRow] =
			params.modelId === null
				? []
				: yield* db
						.select({
							input: model.inputPrice,
							cacheRead: model.cacheReadPrice,
							cacheWrite: model.cacheWritePrice,
							output: model.outputPrice,
							request: model.requestPrice,
							webSearch: model.webSearchPrice,
						})
						.from(model)
						.where(
							and(
								eq(model.id, params.modelId as ModelId),
								eq(model.providerId, params.providerId),
							),
						)
						.limit(1);

		return {
			...providerRow,
			model: modelRow ?? null,
		};
	});
