import { useRouter } from "@tanstack/react-router";
import { useFormSubmission } from "@/hooks/form/use-form-submission";
import { orpc } from "@/lib/orpc/orpc";

export const useOrganizationFormSubmission = () => {
	const router = useRouter();

	const create = useFormSubmission({
		mutationOptions: () => orpc.organization.create.mutationOptions(),
		messages: {
			loading: "Creating organization...",
			success: "Organization created successfully",
			error: "Failed to create organization",
		},
		onSuccess: (result) =>
			router.navigate({
				to: "/app/orgs/$orgId",
				params: { orgId: result.data.id },
			}),
	});

	const update = useFormSubmission({
		mutationOptions: () => orpc.organization.update.mutationOptions(),
		messages: {
			loading: "Updating organization...",
			success: "Organization updated successfully",
			error: "Failed to update organization",
		},
		onSuccess: () => router.history.back(),
	});

	return { create, update };
};
