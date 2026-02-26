import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";

export const useChangePasswordMutation = () => {
	const changePassword = useMutationAction({
		mutationOptions: () => orpc.user.updatePassword.mutationOptions(),
		messages: {
			loading: "Changing password...",
			success: "Password changed",
			error: "Failed to change password",
		},
	});

	return { changePassword };
};
