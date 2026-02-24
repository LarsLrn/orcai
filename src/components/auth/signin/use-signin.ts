import { useNavigate } from "@tanstack/react-router";
import type { SigninSchemaType } from "@/db/zod/signin";
import { useFormSubmission } from "@/hooks/form/use-form-submission";
import { useUmami } from "@/hooks/use-umami";
import { authClient } from "@/lib/auth/auth-client";

export const useSigninSubmission = () => {
	const navigate = useNavigate();
	const { trackEvent } = useUmami();

	return useFormSubmission({
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
		}),
		messages: {
			loading: "Logging in...",
			success: "Welcome back!",
			error: "Login failed",
		},
		onSuccess: (result) => {
			trackEvent("auth-login", {
				email: result.data?.user?.email,
			});
			navigate({ to: "/app" });
		},
	});
};
