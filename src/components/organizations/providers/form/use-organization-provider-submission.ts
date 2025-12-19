import { useRouter } from "@tanstack/react-router";
import { useFormSubmission } from "@/hooks/form/use-form-submission";
import { orpc } from "@/lib/orpc/orpc";

export const useOrganizationProviderFormSubmission = () => {
	const router = useRouter();

	const create = useFormSubmission({
		mutationOptions: () => orpc.organizationProvider.create.mutationOptions(),
		messages: {
			loading: "Creating provider...",
			success: "Provider created successfully",
			error: "Failed to create provider",
		},
		onSuccess: (result) =>
			router.navigate({
				to: "/app/orgs/$orgId/providers/$providerSlug",
				params: {
					providerSlug: result.data.providerSlug,
					orgId: result.data.organizationId,
				},
			}),
	});

	const update = useFormSubmission({
		mutationOptions: () => orpc.organizationProvider.update.mutationOptions(),
		messages: {
			loading: "Updating provider...",
			success: "Provider updated successfully",
			error: "Failed to update provider",
		},
		onSuccess: () => router.history.back(),
	});

	return { create, update };
};
