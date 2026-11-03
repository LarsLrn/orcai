import { useQueryClient } from "@tanstack/react-query";
import { type NavigateOptions, useNavigate } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";
import { openAfterOrganizationSwitch } from "./organization-switch";

/** Switches the active organisation, then opens `target`. */
export const useSetActiveOrganizationMutation = (
	target: NavigateOptions = {
		to: "/app",
	},
) => {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.user.setActiveOrganization.mutationOptions({
				onSuccess: () =>
					openAfterOrganizationSwitch(queryClient, {
						navigate: () => navigate(target),
						guards: [
							orpc.authorization.organizationCapabilities.key(),
						],
					}),
			}),
		messages: {
			loading: m.users_set_active_organisation_toast_loading(),
			success: m.users_set_active_organisation_toast_success(),
			error: m.users_set_active_organisation_toast_error(),
		},
	});
};
