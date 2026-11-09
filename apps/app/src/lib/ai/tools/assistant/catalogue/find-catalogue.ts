import * as Effect from "effect/Effect";
import { effectTool } from "@/lib/ai/tools/tool-builders";
import { listPage, listPaging, PAGING_NOTE } from "../list-input";
import { type AssistantToolDeps, callProcedure } from "../procedure-tool";
import { findCatalogueInputSchema } from "./find-catalogue.declaration";

export const findCatalogueTool = (deps: AssistantToolDeps) =>
	effectTool({
		description: `Find what organisations on this instance list in the Catalogue: bots, behaviours and repositories, newest first. Pass an entry's \`entry\` to addFromCatalogue. \`state\` tells whether the active organisation is the entry's home organisation, added it already, or can add it with addFromCatalogue. A bot's \`model\` is what its home organisation's setup asks for. ${PAGING_NOTE}`,
		inputSchema: findCatalogueInputSchema,
		run: ({ query, kind, page }) =>
			Effect.gen(function* () {
				const entries = yield* callProcedure(deps, (procedures, options) =>
					procedures.catalogue.list(
						{
							...listPage(page),
							search: query,
							kind,
						},
						options,
					),
				);

				return {
					entries: entries.data.map((entry) => ({
						entry:
							entry.kind === "bot"
								? {
										targetType: "bot" as const,
										targetId: entry.id,
									}
								: {
										targetType: "block" as const,
										targetId: entry.id,
									},
						kind: entry.kind,
						name: entry.name,
						description: entry.description,
						from: entry.homeOrganization.name,
						state: entry.state,
						model: entry.modelHint,
						assets: entry.assets,
					})),
					...listPaging(page, entries.rowCount),
				};
			}),
	});
