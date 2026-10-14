import type { ResetPasswordSchemaType } from "@orcai/schema";
import { useNavigate } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { authClient } from "@/lib/auth/auth-client";
import { toAuthError } from "@/lib/errors/auth-error";
import { m } from "@/paraglide/messages";

export const useResetPassword = (token: string) => {
	const navigate = useNavigate();
	return useMutationAction({
		mutationOptions: () => ({
			mutationFn: async (value: ResetPasswordSchemaType) => {
				const result = await authClient.resetPassword({
					newPassword: value.password,
					token,
				});
				if (result.error) throw toAuthError(result.error);
				return result;
			},
			onSuccess: () =>
				navigate({
					to: "/login",
					replace: true,
				}),
		}),
		messages: {
			loading: m.auth_reset_password_toast_loading(),
			success: m.auth_reset_password_toast_success(),
			error: m.auth_reset_password_toast_error(),
		},
	});
};
