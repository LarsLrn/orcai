import type { EmailActionSchemaType } from "@orcai/schema";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { authClient } from "@/lib/auth/auth-client";
import { m } from "@/paraglide/messages";

export const useForgotPassword = () =>
	useMutationAction({
		mutationOptions: () => ({
			mutationFn: async (value: EmailActionSchemaType) => {
				const result = await authClient.requestPasswordReset({
					email: value.email,
					redirectTo: `${window.location.origin}/reset-password`,
				});
				if (result.error) throw new Error(result.error.message);
				return result;
			},
		}),
		messages: {
			loading: m.auth_forgot_password_toast_loading(),
			success: m.auth_forgot_password_toast_success(),
			error: m.auth_forgot_password_toast_error(),
		},
	});
