import type { SignupSchemaType } from "@orcai/schema";
import { type LinkProps, useNavigate } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { useUmami } from "@/hooks/use-umami";
import { authClient } from "@/lib/auth/auth-client";

export const useSignup = () => {
	const navigate = useNavigate();
	const { trackEvent } = useUmami();
	return useMutationAction({
		mutationOptions: () => ({
			mutationFn: async (values: SignupSchemaType) => {
				const route = "/select-organization" satisfies LinkProps["to"];
				const result = await authClient.signUp.email({
					name: values.name ?? "User",
					email: values.email,
					password: values.password,
					callbackURL: `${window.location.origin}${route}`,
				});

				if (result.error) {
					throw new Error(result.error.message);
				}

				return result;
			},
			onSuccess: (result) => {
				trackEvent("auth-register", {
					email: result.data?.user?.email,
				});
				navigate({
					to: "/verify-email",
					replace: true,
				});
			},
		}),
		messages: {
			loading: "Creating your account...",
			success: "Check your email to continue.",
			error: "Account creation failed",
		},
	});
};
