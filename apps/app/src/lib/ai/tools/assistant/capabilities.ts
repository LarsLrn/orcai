import type { OrganizationCapability } from "@orcai/schema";

/** Any of these offers the bots tools. */
export const CONTENT_CAPABILITIES = [
	"create_bot",
	"create_block",
	"create_asset",
] as const satisfies OrganizationCapability[];
