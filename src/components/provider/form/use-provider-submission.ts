import { useRouter } from "@tanstack/react-router";
import { useFormSubmission } from "@/hooks/form/use-form-submission";
import { orpc } from "@/lib/orpc/orpc";

export const useProviderFormSubmission = () => {
	const router = useRouter();

	const create = useFormSubmission({
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

	const update = useFormSubmission({
		mutationOptions: () => orpc.provider.update.mutationOptions(),
		messages: {
			loading: "Updating provider...",
			success: "Provider updated successfully",
			error: "Failed to update provider",
		},
		onSuccess: () => router.history.back(),
	});

	return { create, update };
};
