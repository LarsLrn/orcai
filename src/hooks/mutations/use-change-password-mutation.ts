import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";

export const useChangePasswordMutation = (
	opts: ReturnType<typeof orpc.user.updatePassword.mutationOptions> = {},
) => {
	return useMutationAction({
		mutationOptions: () =>
			orpc.user.updatePassword.mutationOptions({ ...opts }),
		messages: {
			loading: "Changing password...",
			success: "Password changed",
			error: "Failed to change password",
		},
		confirm: {
			title: "Change password",
			description: "Are you sure you want to change your password?",
		},
	});
};
