import { useRouter } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";

export const useBlockMutations = () => {
	const router = useRouter();

	const createBlock = useMutationAction({
		mutationOptions: () => orpc.block.create.mutationOptions(),
		messages: {
			loading: "Creating block...",
			success: "Block created successfully",
			error: "Failed to create block",
		},
		onSuccess: (result) =>
			router.navigate({
				to: "/app/blocks/$blockId",
				params: { blockId: result.data.id },
			}),
	});

	const updateBlock = useMutationAction({
		mutationOptions: () => orpc.block.update.mutationOptions(),
		messages: {
			loading: "Updating block...",
			success: "Block updated successfully",
			error: "Failed to update block",
		},
		onSuccess: () => router.history.back(),
	});

	return { createBlock, updateBlock };
};
