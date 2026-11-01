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

export const catalogueContracts = {
	list: base
		.meta(
			openapi({
				method: "POST",
				path: "/catalogue/list",
				summary:
					"List the bots, behaviours and repositories organisations list",
				tags: [
					"Catalogue",
				],
			}),
		)
		.input(listCatalogueInputSchema)
		.output(listCatalogueResponseSchema),
	counts: base
		.meta(
			openapi({
				method: "POST",
				path: "/catalogue/counts",
				summary: "Count the catalogue's entries by kind and organisation",
				tags: [
					"Catalogue",
				],
			}),
		)
		.input(catalogueCountsInputSchema)
		.output(catalogueCountsResponseSchema),
	find: base
		.meta(
			openapi({
				method: "POST",
				path: "/catalogue/find",
				summary: "Find a catalogue entry with what its page shows",
				tags: [
					"Catalogue",
				],
			}),
		)
		.input(findCatalogueEntryInputSchema)
		.output(findCatalogueEntryResponseSchema),
	add: base
		.meta(
			openapi({
				method: "POST",
				path: "/catalogue/add",
				summary: "Add a catalogue entry to the active organisation",
				tags: [
					"Catalogue",
				],
			}),
		)
		.input(addCatalogueEntryInputSchema)
		.output(addCatalogueEntryResponseSchema),
	addBlocks: base
		.meta(
			openapi({
				method: "POST",
				path: "/catalogue/add-blocks",
				summary:
					"Add the behaviour and repositories of a bot the active organisation added",
				tags: [
					"Catalogue",
				],
			}),
		)
		.input(addCatalogueBotBlocksInputSchema)
		.output(addCatalogueBotBlocksResponseSchema),
	remove: base
		.meta(
			openapi({
				method: "POST",
				path: "/catalogue/remove",
				summary:
					"Remove an entry added from the catalogue from the active organisation",
				tags: [
					"Catalogue",
				],
			}),
		)
		.input(removeCatalogueEntryInputSchema)
		.output(removeCatalogueEntryResponseSchema),
};
