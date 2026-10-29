import { useQueryClient } from "@tanstack/react-query";
import { type LinkProps, useNavigate } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { authClient } from "@/lib/auth/auth-client";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

/** Switches the active organisation, then opens `to`. */
export const useSetActiveOrganizationMutation = (
	opts: ReturnType<typeof orpc.user.setActiveOrganization.mutationOptions> = {},
	to: LinkProps["to"] = "/app",
) => {
	const { refetch: refetchSession } = authClient.useSession();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.user.setActiveOrganization.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					await refetchSession();
					// Only inactive queries, so no mounted observer is left on a removed one.
					queryClient.removeQueries({
						type: "inactive",
					});
					await navigate({
						to,
					});

					await opts.onSuccess?.(...args);
				},
			}),
		messages: {
			loading: m.users_set_active_organisation_toast_loading(),
			success: m.users_set_active_organisation_toast_success(),
			error: m.users_set_active_organisation_toast_error(),
		},
	});
};
