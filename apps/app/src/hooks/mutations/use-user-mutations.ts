import { useQueryClient } from "@tanstack/react-query";
import { type NavigateOptions, useNavigate } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { authClient } from "@/lib/auth/auth-client";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";
import { openAfterOrganizationSwitch } from "./organization-switch";

/** Switches the active organisation, then opens `target`. */
export const useSetActiveOrganizationMutation = (
	opts: ReturnType<typeof orpc.user.setActiveOrganization.mutationOptions> = {},
	target: NavigateOptions = {
		to: "/app",
	},
) => {
	const { refetch: refetchSession } = authClient.useSession();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.user.setActiveOrganization.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					await openAfterOrganizationSwitch(queryClient, {
						refetchSession,
						navigate: () => navigate(target),
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
