import { blockIdSchema, botIdSchema, type CatalogueKind } from "@orcai/schema";
import type { LinkProps } from "@tanstack/react-router";

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

/** The entry in the active organisation's library, where it was made or added. */
export const libraryLink = (entry: {
	kind: CatalogueKind;
	id: string;
}): LinkProps =>
	entry.kind === "bot"
		? {
				to: "/app/library/bots/$botId",
				params: {
					botId: botIdSchema.parse(entry.id),
				},
			}
		: {
				to:
					entry.kind === "behaviour"
						? "/app/library/behaviours/$blockId"
						: "/app/library/repositories/$blockId",
				params: {
					blockId: blockIdSchema.parse(entry.id),
				},
			};
