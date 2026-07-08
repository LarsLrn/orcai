import type { ResetPasswordSchemaType } from "@orcai/schema";
import { useNavigate } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { authClient } from "@/lib/auth/auth-client";

export const useResetPassword = (token: string) => {
	const navigate = useNavigate();
	return useMutationAction({
		mutationOptions: () => ({
			mutationFn: async (value: ResetPasswordSchemaType) => {
				const result = await authClient.resetPassword({
					newPassword: value.password,
					token,
				});
				if (result.error) throw new Error(result.error.message);
				return result;
			},
			onSuccess: () =>
				navigate({
					to: "/login",
					replace: true,
				}),
		}),
		messages: {
			loading: "Resetting password...",
			success: "Your password has been reset. You can now sign in.",
			error: "The reset link is invalid or expired",
		},
	});
};
