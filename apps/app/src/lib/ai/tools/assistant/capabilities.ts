import type { OrganizationCapability } from "@orcai/schema";

/** Any of these offers the bots tools. */
export const CONTENT_CAPABILITIES = [
	"create_bot",
	"create_block",
	"create_asset",
] as const satisfies OrganizationCapability[];

/** Any of these offers the catalogue tools: authors find entries, adders add them. */
export const CATALOGUE_CAPABILITIES = [
	...CONTENT_CAPABILITIES,
	"add_from_catalogue",
] as const satisfies OrganizationCapability[];
