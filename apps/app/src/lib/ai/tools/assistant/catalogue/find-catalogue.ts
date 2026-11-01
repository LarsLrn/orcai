import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import { listLimitSchema, listQuerySchema } from "../core/list-input";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
} from "../procedure-tool";

const findCatalogueInputSchema = z.strictObject({
	query: listQuerySchema,
	kind: z
		.enum([
			"bot",
			"template",
			"repository",
		])
		.optional()
		.describe(
			"Only entries of this kind (template: a behaviour). Every kind when left out.",
		),
	limit: listLimitSchema,
});

const catalogueKinds = {
	bot: "bot",
	template: "behaviour",
	repository: "repository",
} as const;

export const findCatalogueTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Find what organisations on this instance list in the Catalogue: bots, behaviours and repositories, newest first. Pass an entry's `entry` to addFromCatalogue. `state` tells whether the active organisation is the entry's home organisation, added it already, or can add it with addFromCatalogue. A bot's `model` is what its home organisation's setup asks for.",
		inputSchema: findCatalogueInputSchema,
		run: ({ query, kind, limit }) =>
			Effect.gen(function* () {
				const entries = yield* callProcedure(deps, (procedures, options) =>
					procedures.catalogue.list(
						{
							pageIndex: 0,
							pageSize: limit,
							search: query,
							kind: kind && catalogueKinds[kind],
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
						kind: entry.kind === "behaviour" ? "template" : entry.kind,
						name: entry.name,
						description: entry.description,
						from: entry.homeOrganization.name,
						state: entry.state,
						model: entry.modelHint,
						assets: entry.assets,
					})),
					total: entries.rowCount,
				};
			}),
	});
