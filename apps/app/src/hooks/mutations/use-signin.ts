import type { SigninSchemaType } from "@orcai/schema";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { useEnterApp } from "@/hooks/use-enter-app";
import { authClient } from "@/lib/auth/auth-client";
import { toAuthError } from "@/lib/errors/auth-error";
import { m } from "@/paraglide/messages";

export const useSignin = () => {
	const navigate = useNavigate();
	const enterApp = useEnterApp();
	const { inv } = useSearch({
		strict: false,
	});

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
				return result.data;
			},
			onSuccess: (data) => {
				if ("twoFactorRedirect" in data) {
					navigate({
						to: "/two-factor",
						search: {
							inv,
						},
					});
					return;
				}
				enterApp(data.user);
			},
		}),
		messages: {
			loading: m.auth_signin_toast_loading(),
			success: ({ data }) =>
				"twoFactorRedirect" in data
					? m.auth_signin_toast_two_factor()
					: m.auth_signin_toast_success(),
			error: m.auth_signin_toast_error(),
		},
	});
};
