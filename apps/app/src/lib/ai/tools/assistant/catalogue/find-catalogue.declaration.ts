import { catalogueKindSchema } from "@orcai/schema";
import { StoreIcon } from "lucide-react";
import { z } from "zod/v4";
import { declareTool } from "@/lib/ai/tools/declaration";
import { m } from "@/paraglide/messages";
import { CATALOGUE_CAPABILITIES } from "../capabilities";
import { listPageSchema, listQuerySchema } from "../core/list-input";
import type { findCatalogueTool } from "./find-catalogue";

export const findCatalogueInputSchema = z.strictObject({
	query: listQuerySchema,
	kind: catalogueKindSchema
		.optional()
		.describe("Only entries of this kind. Every kind when left out."),
	page: listPageSchema,
});

export const findCatalogue = declareTool<typeof findCatalogueTool>()({
	kind: "read",
	group: "bots",
	capabilities: CATALOGUE_CAPABILITIES,
	inputSchema: findCatalogueInputSchema,
	icon: StoreIcon,
	name: () => m.assistant_tool_find_catalogue_name(),
	active: () => m.assistant_tool_find_catalogue_active(),
	line: ({ output }) =>
		output
			? m.assistant_tool_find_catalogue_summary({
					count: output.total,
				})
			: m.assistant_tool_find_catalogue_name(),
});
