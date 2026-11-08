import type { CatalogueEntryRef } from "@orcai/schema";
import {
	type CatalogueSearch,
	type CatalogueView,
	catalogueCountsInput,
	catalogueListInput,
} from "@/lib/catalogue/catalogue-filters";
import { orpc } from "@/lib/orpc/orpc";

/** A view's entries for its search params, as its loader and its page read them. */
export const catalogueListQuery = (
	view: CatalogueView,
	search: CatalogueSearch<CatalogueView>,
) =>
	orpc.catalogue.list.queryOptions({
		input: catalogueListInput(view, search),
	});

/** The rail's counts and, without a search, the organisations with entries. */
export const catalogueCountsQuery = (
	search: Parameters<typeof catalogueCountsInput>[0],
) =>
	orpc.catalogue.counts.queryOptions({
		input: catalogueCountsInput(search),
	});

export const catalogueEntryQuery = (entry: CatalogueEntryRef) =>
	orpc.catalogue.find.queryOptions({
		input: {
			entry,
		},
	});
