import {
	catalogueCountsInputSchema,
	catalogueCountsResponseSchema,
	findCatalogueEntryInputSchema,
	findCatalogueEntryResponseSchema,
	installCatalogueBotBlocksInputSchema,
	installCatalogueBotBlocksResponseSchema,
	installCatalogueEntryInputSchema,
	installCatalogueEntryResponseSchema,
	listCatalogueInputSchema,
	listCatalogueResponseSchema,
	uninstallCatalogueEntryInputSchema,
	uninstallCatalogueEntryResponseSchema,
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
	install: base
		.meta(
			openapi({
				method: "POST",
				path: "/catalogue/install",
				summary: "Add a catalogue entry to the active organisation",
				tags: [
					"Catalogue",
				],
			}),
		)
		.input(installCatalogueEntryInputSchema)
		.output(installCatalogueEntryResponseSchema),
	installBlocks: base
		.meta(
			openapi({
				method: "POST",
				path: "/catalogue/install-blocks",
				summary:
					"Add the behaviour and repositories of a bot the active organisation added",
				tags: [
					"Catalogue",
				],
			}),
		)
		.input(installCatalogueBotBlocksInputSchema)
		.output(installCatalogueBotBlocksResponseSchema),
	uninstall: base
		.meta(
			openapi({
				method: "POST",
				path: "/catalogue/uninstall",
				summary:
					"Remove an entry added from the catalogue from the active organisation",
				tags: [
					"Catalogue",
				],
			}),
		)
		.input(uninstallCatalogueEntryInputSchema)
		.output(uninstallCatalogueEntryResponseSchema),
};
