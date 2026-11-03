import type { ResourceType } from "@orcai/schema";
import { asset } from "./schema/asset";
import { block } from "./schema/block";
import { bot } from "./schema/bot";

/** The table of each resource type. */
export const resourceTables = {
	bot,
	block,
	asset,
} satisfies Record<ResourceType, unknown>;
