import type { AssetId, BlockId } from "@orcai/core";
import type { BlockType, PublicationStatus } from "@orcai/schema";
import { type BlockKind, wrongBlockText } from "@/lib/ai/tools/entity-kind";
import { AssistantToolError } from "@/lib/ai/tools/tool-error";

/** The editor stores a blank description as null. */
export const blockDescription = (description: string) =>
	description.trim() ? description : null;

export const uniqueAssetIds = (ids: readonly AssetId[]) => [
	...new Set(ids),
];

/** A block of the other kind, read as a missing one of the expected kind. */
export const wrongBlockError = (
	expected: BlockKind,
	id: string,
	actual: BlockType,
) => new AssistantToolError(wrongBlockText(expected, id, actual));

/** What a block tool tells the model about the block it wrote. */
interface SavedBlock {
	id: BlockId;
	name: string;
	status: PublicationStatus;
}

export const behaviourOutline = (block: SavedBlock) => ({
	type: "behaviour" as const,
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
