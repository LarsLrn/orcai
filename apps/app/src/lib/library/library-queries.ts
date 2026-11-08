import type { LibraryScope } from "@orcai/schema";
import {
	libraryCountsInput,
	libraryListInput,
} from "@/lib/library/library-filters";
import { orpc } from "@/lib/orpc/orpc";

type ListSearch<V extends keyof typeof libraryListInput> = Parameters<
	(typeof libraryListInput)[V]
>[0];

/** A view's results for its search params, as its loader and its page read them. */
export const libraryListQuery = {
	overview: (search: ListSearch<"overview">) =>
		orpc.library.search.queryOptions({
			input: libraryListInput.overview(search),
		}),
	bot: (search: ListSearch<"bot">) =>
		orpc.bot.list.queryOptions({
			input: libraryListInput.bot(search),
		}),
	behaviour: (search: ListSearch<"behaviour">) =>
		orpc.block.list.queryOptions({
			input: libraryListInput.behaviour(search),
		}),
	repository: (search: ListSearch<"repository">) =>
		orpc.block.list.queryOptions({
			input: libraryListInput.repository(search),
		}),
	asset: (search: ListSearch<"asset">) =>
		orpc.asset.list.queryOptions({
			input: libraryListInput.asset(search),
		}),
};

/** Overview's shelves without a search. */
export const libraryOverviewQuery = (scope: LibraryScope) =>
	orpc.library.overview.queryOptions({
		input: {
			scope,
		},
	});

/** The rail's counts. */
export const libraryCountsQuery = (
	search: Parameters<typeof libraryCountsInput>[0],
) =>
	orpc.library.counts.queryOptions({
		input: libraryCountsInput(search),
	});
