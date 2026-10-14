import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const useChangePasswordMutation = (
	opts: ReturnType<typeof orpc.user.updatePassword.mutationOptions> = {},
) => {
	return useMutationAction({
		mutationOptions: () =>
			orpc.user.updatePassword.mutationOptions({
				...opts,
			}),
		messages: {
			loading: m.account_change_password_toast_loading(),
			success: m.account_change_password_toast_success(),
			error: m.account_change_password_toast_error(),
		},
		confirm: {
			title: m.account_change_password_confirm_title(),
			description: m.account_change_password_confirm_description(),
		},
	});
};
