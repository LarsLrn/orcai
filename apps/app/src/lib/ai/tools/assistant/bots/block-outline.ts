import type { AssetId, BlockId } from "@orcai/core";
import type { PublicationStatus } from "@orcai/schema";
import { AssistantToolError } from "@/lib/ai/tools/tool-error";
import { wrongIdText } from "../procedure-tool";

/** The editor stores a blank description as null. */
export const blockDescription = (description: string) =>
	description.trim() ? description : null;

export const uniqueAssetIds = (ids: readonly AssetId[]) => [
	...new Set(ids),
];

/** A block of the other kind, read as a missing one of the expected kind. */
export const wrongBlockError = (
	expected: "template" | "repository",
	id: string,
	actual: string,
) =>
	new AssistantToolError(
		`${wrongIdText(
			expected,
			id,
			expected === "template"
				? "BEHAVIOUR_BLOCK_TYPE_INVALID"
				: "REPOSITORY_BLOCK_TYPE_INVALID",
		)} That id is a ${actual === "database" ? "repository" : actual}.`,
	);

/** What a block tool tells the model about the block it wrote. */
interface SavedBlock {
	id: BlockId;
	name: string;
	status: PublicationStatus;
}

export const templateOutline = (block: SavedBlock) => ({
	type: "template" as const,
	id: block.id,
	name: block.name,
	status: block.status,
});

export const repositoryOutline = ({
	data,
	assets,
}: {
	data: SavedBlock;
	assets?: readonly unknown[];
}) => ({
	type: "repository" as const,
	id: data.id,
	name: data.name,
	status: data.status,
	assetCount: assets?.length ?? 0,
});
