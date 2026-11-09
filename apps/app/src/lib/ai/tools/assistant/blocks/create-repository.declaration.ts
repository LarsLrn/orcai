import {
	assetIdSchema,
	blockFieldsSchema,
	publicationStatusSchema,
} from "@orcai/schema";
import { LibraryIcon } from "lucide-react";
import { z } from "zod/v4";
import { declareTool, formatNames } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { CONTENT_CAPABILITIES } from "../capabilities";
import type { createRepositoryTool } from "./create-repository";

export const createRepositoryInputSchema = z.strictObject({
	name: z.string().min(1).describe("The repository's name, a few words."),
	description: blockFieldsSchema.shape.description
		.unwrap()
		.optional()
		.describe("Short plain-text description, up to 500 characters."),
	status: publicationStatusSchema
		.optional()
		.describe("ready: Published, so bots can use it. Defaults to draft."),
	assetIds: z
		.array(assetIdSchema)
		.optional()
		.describe(
			"Ids of the Library assets the repository holds, from findAssets with keptIn library.",
		),
});

export const createRepository = declareTool<typeof createRepositoryTool>()({
	kind: "create",
	group: "bots",
	capabilities: CONTENT_CAPABILITIES,
	inputSchema: createRepositoryInputSchema,
	icon: LibraryIcon,
	name: () => m.assistant_tool_create_repository_name(),
	active: () => m.assistant_tool_create_repository_active(),
	line: ({ input, output }) => {
		const name = output ? output.name : input?.name;

		return name
			? m.assistant_tool_create_repository_summary({
					name: formatNames([
						name,
					]),
				})
			: m.assistant_tool_create_repository_name();
	},
	written: ({ id, name }) => ({
		kind: "repository",
		id,
		name,
	}),
});
