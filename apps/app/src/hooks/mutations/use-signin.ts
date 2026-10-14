import type { SigninSchemaType } from "@orcai/schema";
import { useNavigate } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { useUmami } from "@/hooks/use-umami";
import { authClient } from "@/lib/auth/auth-client";
import { toAuthError } from "@/lib/errors/auth-error";
import { m } from "@/paraglide/messages";

export const useSignin = () => {
	const navigate = useNavigate();
	const { trackEvent } = useUmami();

	return useMutationAction({
		mutationOptions: () => ({
			mutationFn: async (values: SigninSchemaType) => {
				const result = await authClient.signIn.email({
					email: values.email,
					password: values.password,
				});
				if (result.error) {
					throw toAuthError(result.error);
				}
				return result;
			},
			onSuccess: () => {
				trackEvent("auth-login");
				navigate({
					to: "/app",
				});
			},
		}),
		messages: {
			loading: m.auth_signin_toast_loading(),
			success: m.auth_signin_toast_success(),
			error: m.auth_signin_toast_error(),
		},
	});
};
