import type { SigninSchemaType } from "@orcai/schema";
import { useNavigate } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { useUmami } from "@/hooks/use-umami";
import { authClient } from "@/lib/auth/auth-client";
import { toAuthError } from "@/lib/errors/auth-error";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

export const useSignin = () => {
	const navigate = useNavigate();
	const { trackEvent } = useUmami();
	const renderedLocale = getLocale();

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
			onSuccess: (result) => {
				trackEvent("auth-login");
				// Sign-in set the stored locale's cookie; only a document load renders it.
				const storedLocale = result.data?.user.locale;
				if (storedLocale && storedLocale !== renderedLocale) {
					window.location.assign("/app");
					return;
				}
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
