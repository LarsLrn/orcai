import * as Effect from "effect/Effect";
import { z } from "zod/v4";
import {
	type AssistantToolDeps,
	callProcedure,
	effectTool,
	mutation,
} from "../procedure-tool";
import {
	catalogueEntryInputSchema,
	toCatalogueEntry,
} from "./catalogue-entry-input";

const installInputSchema = z.strictObject({
	entry: catalogueEntryInputSchema,
	withBlocks: z
		.boolean()
		.default(false)
		.describe(
			"For a bot: also add its behaviour and repositories, each on its own, so the organisation can build its own bots from them. Removing the bot later keeps them. Only when the user asks for them.",
		),
});

export const addFromCatalogueTool = (deps: AssistantToolDeps) =>
	effectTool({
		description:
			"Add a bot, template or repository from the catalogue to the active organisation's library. Never for files: new files come in through requestUpload. Nobody there can use it until it is shared with grantAccess, for use only (viewer). Set an added bot's model here with updateBotSetup. Adding what the organisation has already changes nothing; with withBlocks, blocks it has already are skipped.",
		inputSchema: installInputSchema,
		run: ({ entry, withBlocks }) =>
			Effect.gen(function* () {
				const { data: found } = yield* callProcedure(
					deps,
					(procedures, options) =>
						procedures.catalogue.find(
							{
								entry: toCatalogueEntry(entry),
							},
							options,
						),
				);
				const { data } = yield* callProcedure(deps, (procedures, options) =>
					procedures.catalogue.install(
						{
							entry: toCatalogueEntry(entry),
							withBlocks,
						},
						options,
					),
				).pipe(mutation("findCatalogue"));
				return {
					...entry,
					name: found.name,
					from: found.source.name,
					added: data.changed,
					addedBlocks: data.addedBlocks,
				};
			}),
	});
