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

const tagged = base.meta(
	openapi({
		tags: [
			"Library",
		],
	}),
);

export const libraryContracts = {
	counts: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/library/counts",
				summary: "Count the active organisation's Library by kind",
			}),
		)
		.input(libraryCountsInputSchema)
		.output(libraryCountsResponseSchema),
	overview: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/library/overview",
				summary: "The Library's sections: favourites, drafts and each kind",
			}),
		)
		.input(libraryOverviewInputSchema)
		.output(libraryOverviewResponseSchema),
	search: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/library/search",
				summary: "Search every kind of the Library in one ordered list",
			}),
		)
		.input(searchLibraryInputSchema)
		.output(searchLibraryResponseSchema),
};
