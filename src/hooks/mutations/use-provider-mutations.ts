import { useRouter } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";

export const useProviderMutations = () => {
	const router = useRouter();

	const createProvider = useMutationAction({
		mutationOptions: () => orpc.provider.create.mutationOptions(),
		messages: {
			loading: "Creating provider...",
			success: "Provider created successfully",
			error: "Failed to create provider",
		},
		onSuccess: (result) =>
			router.navigate({
				to: "/app/providers/$providerId",
				params: {
					providerId: result.data.id,
				},
			}),
	});

	const updateProvider = useMutationAction({
		mutationOptions: () => orpc.provider.update.mutationOptions(),
		messages: {
			loading: "Updating provider...",
			success: "Provider updated successfully",
			error: "Failed to update provider",
		},
		onSuccess: () => router.history.back(),
	});

	return { createProvider, updateProvider };
};
