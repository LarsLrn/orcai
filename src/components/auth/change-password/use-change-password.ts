import { useFormSubmission } from "@/hooks/form/use-form-submission";
import { orpc } from "@/lib/orpc/orpc";

export const useChangePasswordSubmission = () => {
	return useFormSubmission({
		mutationOptions: () => orpc.user.updatePassword.mutationOptions(),
		messages: {
			loading: "Changing password...",
			success: "Password changed",
			error: "Failed to change password",
		},
	});
};
