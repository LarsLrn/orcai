import { useNavigate } from "@tanstack/react-router";
import type { SignupSchemaType } from "@/db/zod/signup";
import { useFormSubmission } from "@/hooks/form/use-form-submission";
import { useUmami } from "@/hooks/use-umami";
import { authClient } from "@/lib/auth-client";

export const useSignupSubmission = () => {
	const navigate = useNavigate();
	const { trackEvent } = useUmami();

	return useFormSubmission({
		mutationOptions: () => ({
			mutationFn: async (values: SignupSchemaType) => {
				const result = await authClient.signUp.email({
					name: values.name ?? "User",
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
			loading: "Creating your account...",
			success: "Account successfully created!",
			error: "Account creation failed",
		},
		onSuccess: (result) => {
			trackEvent("auth-register", {
				email: result.data?.user?.email,
			});
			navigate({ to: "/", replace: true });
		},
	});
};
