import * as Effect from "effect/Effect";
import { effectTool } from "@/lib/ai/tools/tool-builders";
import { type AssistantToolDeps, callProcedure } from "../procedure-tool";
import { findBotsInputSchema } from "./find-bots.declaration";
import { listPage, listPaging, PAGING_NOTE } from "./list-input";

const toFoundBot = (bot: {
	id: string;
	name: string;
	description: string;
	status: "draft" | "ready";
	isFavourite: boolean;
	capabilities: Record<string, boolean>;
}) => ({
	id: bot.id,
	name: bot.name,
	description: bot.description,
	status: bot.status,
	canEdit: bot.capabilities.edit === true,
	favourite: bot.isFavourite,
});

export const findBotsTool = (deps: AssistantToolDeps) =>
	effectTool({
		description: `Find bots by name among the published bots the user can use and the drafts they can edit, sorted by name. Without a query it pages through all of them. \`favourite\` marks the published bots the user made a favourite. ${PAGING_NOTE}`,
		inputSchema: findBotsInputSchema,
		run: ({ query, page }) =>
			Effect.gen(function* () {
				const bots = yield* callProcedure(deps, (procedures, options) =>
					procedures.bot.list(
						{
							...listPage(page),
							search: query,
							filters: {
								status: "all",
							},
						},
						options,
					),
				);

				return {
					bots: bots.data.map(toFoundBot),
					...listPaging(page, bots.rowCount),
				};
			}),
	});
