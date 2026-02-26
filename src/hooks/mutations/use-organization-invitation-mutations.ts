import { useRouter } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";

export const useOrganizationInvitationMutations = () => {
	const router = useRouter();

	const createInvitation = useMutationAction({
		mutationOptions: orpc.organizationInvitation.create.mutationOptions,
		messages: {
			loading: "Creating invitations...",
			success: "Invitations created successfully",
			error: "Failed to create invitations",
		},
		onSuccess: () =>
			router.navigate({
				to: "/app/users/invites",
			}),
	});

	return { createInvitation };
};
