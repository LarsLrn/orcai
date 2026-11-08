import {
	assetIdSchema,
	blockFieldsSchema,
	blockIdSchema,
	publicationStatusSchema,
} from "@orcai/schema";
import { LibraryIcon } from "lucide-react";
import { z } from "zod/v4";
import { batchSummary, declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { CONTENT_CAPABILITIES } from "../capabilities";
import type { updateRepositoryTool } from "./update-repository";

export const updateRepositoryInputSchema = z.strictObject({
	id: blockIdSchema.describe("Id of the repository to update."),
	name: z
		.string()
		.min(1)
		.optional()
		.describe("Leave out to keep the current name."),
	description: blockFieldsSchema.shape.description
		.unwrap()
		.optional()
		.describe(
			"Short plain-text description, up to 500 characters. Leave out to keep the current one.",
		),
	status: publicationStatusSchema
		.optional()
		.describe(
			"ready: Published, so bots can use it. Leave out to keep the current status.",
		),
	assetIds: z
		.array(assetIdSchema)
		.optional()
		.describe(
			"Ids of every Library asset the repository holds, from findAssets with keptIn library; replaces the current set, [] empties it. Assets taken out stay in the Library. Leave out to keep the current assets.",
		),
});

export const updateRepository = declareTool<typeof updateRepositoryTool>()({
	kind: "change",
	group: "bots",
	capabilities: CONTENT_CAPABILITIES,
	inputSchema: updateRepositoryInputSchema,
	icon: LibraryIcon,
	name: () => m.assistant_tool_update_repository_name(),
	active: () => m.assistant_tool_update_repository_active(),
	...batchSummary<typeof updateRepositoryTool>({
		kind: "repository",
		ids: (input) =>
			input && [
				input.id,
			],
		pendingName: (input) => input.name,
		named: (output) => [
			{
				id: output.id,
				name: output.name,
			},
		],
		summary: m.assistant_tool_update_repository_summary,
	}),
	written: ({ id, name }) => ({
		kind: "repository",
		id,
		name,
	}),
});
