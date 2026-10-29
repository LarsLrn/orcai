import type { BlockId } from "@orcai/core";

export type ExposedBlock = {
	id: BlockId;
	name: string;
	listed: boolean;
	canManageAccess: boolean;
};

export type BlocksToList =
	| {
			readonly _tag: "List";
			readonly blockIds: readonly BlockId[];
	  }
	| {
			readonly _tag: "Forbidden";
			readonly blocks: readonly ExposedBlock[];
	  }
	| {
			readonly _tag: "Unconfirmed";
			readonly blocks: readonly ExposedBlock[];
	  };

/**
 * What a listed bot that contains `blocks` needs: a listed bot contains only
 * listed blocks, so its unlisted ones are listed with it, provided the actor
 * manages access to each and confirmed each by id.
 */
export const blocksToList = (
	blocks: readonly ExposedBlock[],
	confirmedIds: readonly BlockId[],
): BlocksToList => {
	const unlisted = blocks.filter((block) => !block.listed);
	const forbidden = unlisted.filter((block) => !block.canManageAccess);
	if (forbidden.length > 0)
		return {
			_tag: "Forbidden",
			blocks: forbidden,
		};

	const confirmed = new Set(confirmedIds);
	const unconfirmed = unlisted.filter((block) => !confirmed.has(block.id));
	if (unconfirmed.length > 0)
		return {
			_tag: "Unconfirmed",
			blocks: unconfirmed,
		};

	return {
		_tag: "List",
		blockIds: unlisted.map((block) => block.id),
	};
};
