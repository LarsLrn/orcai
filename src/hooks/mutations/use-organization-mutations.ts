import { useRouter } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";

export const useOrganizationMutations = () => {
	const router = useRouter();

	const createOrganization = useMutationAction({
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

	const updateOrganization = useMutationAction({
		mutationOptions: () => orpc.organization.update.mutationOptions(),
		messages: {
			loading: "Updating organization...",
			success: "Organization updated successfully",
			error: "Failed to update organization",
		},
		onSuccess: () => router.history.back(),
	});

	return { createOrganization, updateOrganization };
};
