import { useRouter } from "@tanstack/react-router";
import { useFormSubmission } from "@/hooks/form/use-form-submission";
import { orpc } from "@/lib/orpc/orpc";

export const useOrganizationInvitationFormSubmission = () => {
	const router = useRouter();

	const create = useFormSubmission({
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

	return { create };
};
