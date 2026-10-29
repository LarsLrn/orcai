import {
	libraryCountsInputSchema,
	libraryCountsResponseSchema,
	libraryOverviewInputSchema,
	libraryOverviewResponseSchema,
	searchLibraryInputSchema,
	searchLibraryResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

export const libraryContracts = {
	counts: base
		.meta(
			openapi({
				method: "POST",
				path: "/library/counts",
				summary: "Count the active organization's library by kind",
				tags: [
					"Library",
				],
			}),
		)
		.input(libraryCountsInputSchema)
		.output(libraryCountsResponseSchema),
	overview: base
		.meta(
			openapi({
				method: "POST",
				path: "/library/overview",
				summary: "The library's shelves: favourites, drafts and each kind",
				tags: [
					"Library",
				],
			}),
		)
		.input(libraryOverviewInputSchema)
		.output(libraryOverviewResponseSchema),
	search: base
		.meta(
			openapi({
				method: "POST",
				path: "/library/search",
				summary: "Search every kind of the library in one ordered list",
				tags: [
					"Library",
				],
			}),
		)
		.input(searchLibraryInputSchema)
		.output(searchLibraryResponseSchema),
};
