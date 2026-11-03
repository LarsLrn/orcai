import {
	addCatalogueBotBlocksInputSchema,
	addCatalogueBotBlocksResponseSchema,
	addCatalogueEntryInputSchema,
	addCatalogueEntryResponseSchema,
	catalogueCountsInputSchema,
	catalogueCountsResponseSchema,
	findCatalogueEntryInputSchema,
	findCatalogueEntryResponseSchema,
	listCatalogueInputSchema,
	listCatalogueResponseSchema,
	removeCatalogueEntryInputSchema,
	removeCatalogueEntryResponseSchema,
} from "@orcai/schema";
import { openapi } from "@orpc/openapi";
import { base } from "./base";

const tagged = base.meta(
	openapi({
		tags: [
			"Catalogue",
		],
	}),
);

export const catalogueContracts = {
	list: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/catalogue/list",
				summary:
					"List the bots, behaviours and repositories organisations list",
			}),
		)
		.input(listCatalogueInputSchema)
		.output(listCatalogueResponseSchema),
	counts: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/catalogue/counts",
				summary: "Count the Catalogue's entries by kind and organisation",
			}),
		)
		.input(catalogueCountsInputSchema)
		.output(catalogueCountsResponseSchema),
	find: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/catalogue/find",
				summary: "Find a Catalogue entry with what its page shows",
			}),
		)
		.input(findCatalogueEntryInputSchema)
		.output(findCatalogueEntryResponseSchema),
	add: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/catalogue/add",
				summary: "Add a Catalogue entry to the active organisation",
			}),
		)
		.input(addCatalogueEntryInputSchema)
		.output(addCatalogueEntryResponseSchema),
	addBlocks: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/catalogue/add-blocks",
				summary:
					"Add the behaviour and repositories of a bot the active organisation added",
			}),
		)
		.input(addCatalogueBotBlocksInputSchema)
		.output(addCatalogueBotBlocksResponseSchema),
	remove: tagged
		.meta(
			openapi({
				method: "POST",
				path: "/catalogue/remove",
				summary:
					"Remove an entry added from the Catalogue from the active organisation",
			}),
		)
		.input(removeCatalogueEntryInputSchema)
		.output(removeCatalogueEntryResponseSchema),
};
