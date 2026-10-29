import type { BlockId } from "@orcai/core";
import type { BlockType } from "@orcai/schema";
import type { QueryClient } from "@tanstack/react-query";
import { notFound } from "@tanstack/react-router";
import { orpc } from "@/lib/orpc/orpc";
import { orNotFound } from "@/lib/router/not-found";

/** The block behind a kind's path; a block of another type is not found there. */
export const loadBlockOfType = async ({
	queryClient,
	blockId,
	type,
}: {
	queryClient: QueryClient;
	blockId: BlockId;
	type: BlockType;
}) => {
	const block = await orNotFound(
		queryClient.query(
			orpc.block.find.queryOptions({
				input: {
					id: blockId,
				},
				staleTime: "static",
			}),
		),
	);

	if (block.data.type !== type) {
		throw notFound();
	}

	return block;
};
