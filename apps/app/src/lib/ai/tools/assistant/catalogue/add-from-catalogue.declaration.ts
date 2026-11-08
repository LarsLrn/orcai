import { PackagePlusIcon } from "lucide-react";
import { z } from "zod/v4";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import type { addFromCatalogueTool } from "./add-from-catalogue";
import { catalogueEntryInputSchema } from "./catalogue-entry-input";

export const addFromCatalogueInputSchema = z.strictObject({
	entry: catalogueEntryInputSchema,
	withBlocks: z
		.boolean()
		.default(false)
		.describe(
			"For a bot: also add its behaviour and repositories, each on its own, so the organisation can build its own bots from them. Removing the bot later keeps them. Only when the user asks for them.",
		),
});

export const addFromCatalogue = declareTool<typeof addFromCatalogueTool>()({
	kind: "change",
	group: "bots",
	capabilities: [
		"add_from_catalogue",
	],
	confirm: "add",
	inputSchema: addFromCatalogueInputSchema,
	icon: PackagePlusIcon,
	name: () => m.assistant_tool_add_from_catalogue_name(),
	active: () => m.assistant_tool_add_from_catalogue_active(),
	refs: ({ input, output }) =>
		!output && input
			? [
					{
						kind: input.entry.targetType,
						id: input.entry.targetId,
					},
				]
			: [],
	line: ({ input, output }, nameOf) => {
		if (!input) return m.assistant_tool_add_from_catalogue_name();
		const name = m.assistant_tool_quoted_name({
			name:
				output?.name ??
				nameOf({
					kind: input.entry.targetType,
					id: input.entry.targetId,
				}),
		});
		return input.withBlocks && input.entry.targetType === "bot"
			? m.assistant_tool_add_from_catalogue_with_blocks_summary({
					name,
				})
			: m.assistant_tool_add_from_catalogue_summary({
					name,
				});
	},
});
