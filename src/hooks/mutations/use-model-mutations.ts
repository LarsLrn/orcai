import { useRouter } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";

export const useModelMutations = () => {
	const router = useRouter();

	const createModel = useMutationAction({
		mutationOptions: () => orpc.model.create.mutationOptions(),
		messages: {
			loading: "Creating model...",
			success: "Model created successfully",
			error: "Failed to create model",
		},
		onSuccess: (result) =>
			router.navigate({
				to: "/app/models/$modelId",
				params: {
					modelId: result.data.id,
				},
			}),
	});

	const updateModel = useMutationAction({
		mutationOptions: () => orpc.model.update.mutationOptions(),
		messages: {
			loading: "Updating model...",
			success: "Model updated successfully",
			error: "Failed to update model",
		},
		onSuccess: () => router.history.back(),
	});

	return { createModel, updateModel };
};
