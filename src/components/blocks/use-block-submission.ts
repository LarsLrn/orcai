import { useRouter } from "@tanstack/react-router";
import { useFormSubmission } from "@/hooks/form/use-form-submission";
import { orpc } from "@/lib/orpc/orpc";

export const useBlockFormSubmission = () => {
	const router = useRouter();

	const create = useFormSubmission({
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

	const update = useFormSubmission({
		mutationOptions: () => orpc.block.update.mutationOptions(),
		messages: {
			loading: "Updating block...",
			success: "Block updated successfully",
			error: "Failed to update block",
		},
		onSuccess: () => router.history.back(),
	});

	return { create, update };
};
