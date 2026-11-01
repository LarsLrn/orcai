import type { BlockType } from "@orcai/schema";

/** Where a block type lives in the library. */
export const blockPaths = (type: BlockType) =>
	type === "repository"
		? ({
				list: "/app/library/repositories",
				add: "/app/library/repositories/add",
				detail: "/app/library/repositories/$blockId",
				edit: "/app/library/repositories/$blockId/edit",
			} as const)
		: ({
				list: "/app/library/behaviours",
				add: "/app/library/behaviours/add",
				detail: "/app/library/behaviours/$blockId",
				edit: "/app/library/behaviours/$blockId/edit",
			} as const);
