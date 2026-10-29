import {
	activityRunIdSchema,
	type LibraryCountsInput,
	type LibraryKind,
	type ListAssetsInput,
	type ListBlocksInput,
	type ListBotsInput,
	libraryScopeSchema,
	type SearchLibraryInput,
} from "@orcai/schema";
import type { z } from "zod/v4";
import {
	browseSearchDefaults,
	browseSearchSchema,
	type FilterDefinitions,
	filterInput,
	singleFilter,
	toggleFilter,
} from "@/lib/browse/browse-search";
import { m } from "@/paraglide/messages";

const status = singleFilter({
	label: m.library_filter_status_label,
	options: [
		{
			value: "all",
			label: m.library_filter_status_all,
		},
		{
			value: "ready",
			label: m.library_filter_status_published,
		},
		{
			value: "draft",
			label: m.library_filter_status_drafts,
		},
	],
	defaultValue: "all",
	toInput: (value) => ({
		status: value,
	}),
});

const source = singleFilter({
	label: m.library_filter_source_label,
	options: [
		{
			value: "all",
			label: m.library_filter_source_all,
		},
		{
			value: "own",
			label: m.library_filter_source_own,
		},
		{
			value: "installed",
			label: m.library_filter_source_installed,
		},
	],
	defaultValue: "all",
	toInput: (value) => ({
		source: value,
	}),
});

/** The library's filters per view; Overview's apply while searching. */
export const libraryFilters = {
	overview: {
		status,
		source,
	},
	bot: {
		status,
		source,
		favourite: toggleFilter({
			label: m.library_filter_favourites_label,
			optionLabel: m.library_filter_favourites_only,
			toInput: (on) =>
				on
					? {
							favourite: true,
						}
					: {},
		}),
	},
	behaviour: {
		status,
		source,
	},
	repository: {
		status,
		source,
	},
	asset: {
		origin: singleFilter({
			label: m.library_filter_origin_label,
			options: [
				{
					value: "library",
					label: m.library_filter_origin_library,
				},
				{
					value: "chat",
					label: m.library_filter_origin_chat,
				},
			],
			defaultValue: "library",
			toInput: (value) => ({
				origin: value,
			}),
		}),
		processing: singleFilter({
			label: m.library_filter_processing_label,
			options: [
				{
					value: "any",
					label: m.library_filter_processing_any,
				},
				{
					value: "running",
					label: m.library_filter_processing_running,
				},
				{
					value: "failed",
					label: m.library_filter_processing_failed,
				},
			],
			defaultValue: "any",
			toInput: (value) =>
				value === "any"
					? {}
					: {
							processing: value,
						},
		}),
		review: toggleFilter({
			label: m.library_filter_review_label,
			optionLabel: m.library_filter_review_suggestions,
			toInput: (on) =>
				on
					? {
							suggestions: true as const,
						}
					: {},
		}),
	},
} satisfies Record<"overview" | LibraryKind, FilterDefinitions>;

export type LibraryView = keyof typeof libraryFilters;

/** A library view's search params: the browse params, its filters and Mine (`scope`), which views share. */
export const librarySearchSchema = <D extends FilterDefinitions>(filters: D) =>
	browseSearchSchema(filters).extend({
		scope: libraryScopeSchema.catch("all").default("all"),
	});

export const librarySearchDefaults = <D extends FilterDefinitions>(
	filters: D,
) => ({
	...browseSearchDefaults(filters),
	scope: "all" as const,
});

export type LibrarySearch<V extends LibraryView> = z.output<
	ReturnType<typeof librarySearchSchema<(typeof libraryFilters)[V]>>
>;

/** The asset view also opens on one of the reader's activity runs, which stands in for its filters and Mine. */
export const assetLibrarySearchSchema = librarySearchSchema(
	libraryFilters.asset,
).extend({
	run: activityRunIdSchema.optional().catch(undefined),
});

/** What a view lists for its search params: the input of its list procedure. */
export const libraryListInput = {
	overview: (search: LibrarySearch<"overview">): SearchLibraryInput => ({
		pageIndex: search.pageIndex,
		pageSize: search.pageSize,
		search: search.query || undefined,
		scope: search.scope,
		sort: search.sort,
		...filterInput(libraryFilters.overview, search),
	}),
	bot: (search: LibrarySearch<"bot">): ListBotsInput => ({
		pageIndex: search.pageIndex,
		pageSize: search.pageSize,
		search: search.query || undefined,
		sort: search.sort,
		filters: {
			...filterInput(libraryFilters.bot, search),
			scope: search.scope,
		},
	}),
	behaviour: (search: LibrarySearch<"behaviour">): ListBlocksInput => ({
		pageIndex: search.pageIndex,
		pageSize: search.pageSize,
		sort: search.sort,
		filters: {
			...filterInput(libraryFilters.behaviour, search),
			type: "template",
			scope: search.scope,
			search: search.query || undefined,
		},
	}),
	repository: (search: LibrarySearch<"repository">): ListBlocksInput => ({
		pageIndex: search.pageIndex,
		pageSize: search.pageSize,
		sort: search.sort,
		filters: {
			...filterInput(libraryFilters.repository, search),
			type: "database",
			scope: search.scope,
			search: search.query || undefined,
		},
	}),
	asset: (
		search: z.output<typeof assetLibrarySearchSchema>,
	): ListAssetsInput => ({
		pageIndex: search.pageIndex,
		pageSize: search.pageSize,
		sort: search.sort,
		filters: search.run
			? {
					runId: search.run,
					search: search.query || undefined,
				}
			: {
					...filterInput(libraryFilters.asset, search),
					scope: search.scope,
					search: search.query || undefined,
				},
	}),
};

/** The rail's counts follow Mine and the search, not a view's filters. */
export const libraryCountsInput = (search: {
	scope: LibraryCountsInput["scope"];
	query: string;
}): LibraryCountsInput => ({
	scope: search.scope,
	search: search.query || undefined,
});
