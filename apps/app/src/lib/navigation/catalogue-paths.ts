import type { CatalogueKind } from "@orcai/schema";

/** Where a catalogue kind lives: its view, an entry's page and the entry's wizard. */
export const cataloguePaths = (kind: CatalogueKind) =>
	kind === "bot"
		? ({
				list: "/app/catalogue/bots",
				detail: "/app/catalogue/bots/$id",
				add: "/app/catalogue/bots/$id/add",
			} as const)
		: kind === "behaviour"
			? ({
					list: "/app/catalogue/behaviours",
					detail: "/app/catalogue/behaviours/$id",
					add: "/app/catalogue/behaviours/$id/add",
				} as const)
			: ({
					list: "/app/catalogue/repositories",
					detail: "/app/catalogue/repositories/$id",
					add: "/app/catalogue/repositories/$id/add",
				} as const);
