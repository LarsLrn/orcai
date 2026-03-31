import type { SigninSchemaType } from "@orcai/schema";
import { useNavigate } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { useUmami } from "@/hooks/use-umami";
import { authClient } from "@/lib/auth/auth-client";

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
					throw new Error(result.error.message);
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
			loading: "Logging in...",
			success: "Welcome back!",
			error: "Login failed",
		},
	});
};
