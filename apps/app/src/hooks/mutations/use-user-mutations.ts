import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { authClient } from "@/lib/auth/auth-client";
import { orpc } from "@/lib/orpc/orpc";

export const useSetActiveOrganizationMutation = (
	opts: ReturnType<typeof orpc.user.setActiveOrganization.mutationOptions> = {},
) => {
	const { refetch: refetchSession } = authClient.useSession();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.user.setActiveOrganization.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					await navigate({
						to: "/app",
					});
					await refetchSession();
					queryClient.clear();

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useSetActiveOrganizationMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: "Setting active organisation...",
			success: "Active organisation set",
			error: "Failed to set active organisation",
		},
	});
};
