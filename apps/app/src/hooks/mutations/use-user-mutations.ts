import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { authClient } from "@/lib/auth/auth-client";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

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
			loading: m.users_set_active_organisation_toast_loading(),
			success: m.users_set_active_organisation_toast_success(),
			error: m.users_set_active_organisation_toast_error(),
		},
	});
};
