import { useRouter } from "@tanstack/react-router";
import { useFormSubmission } from "@/hooks/form/use-form-submission";
import { orpc } from "@/lib/orpc/orpc";

export const useModelFormSubmission = () => {
	const router = useRouter();

	const create = useFormSubmission({
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

	const update = useFormSubmission({
		mutationOptions: () => orpc.model.update.mutationOptions(),
		messages: {
			loading: "Updating model...",
			success: "Model updated successfully",
			error: "Failed to update model",
		},
		onSuccess: () => router.history.back(),
	});

	return { create, update };
};
