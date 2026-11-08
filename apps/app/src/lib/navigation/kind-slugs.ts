import type { CatalogueKind } from "@orcai/schema";

/** The path segment of a kind's pages in the Library and the Catalogue. */
export const KIND_SLUGS = {
	bot: "bots",
	behaviour: "behaviours",
	repository: "repositories",
} as const satisfies Record<CatalogueKind, string>;
