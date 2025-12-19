import { useRouter } from "@tanstack/react-router";
import { useFormSubmission } from "@/hooks/form/use-form-submission";
import { orpc } from "@/lib/orpc/orpc";

export const useAssetFormSubmission = () => {
	const router = useRouter();

	const update = useFormSubmission({
		mutationOptions: orpc.asset.update.mutationOptions,
		messages: {
			loading: "Updating asset...",
			success: "Asset updated successfully",
			error: "Failed to update asset",
		},
		onSuccess: () => router.history.back(),
	});

	return { update };
};
