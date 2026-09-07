import type { SignupSchemaType } from "@orcai/schema";
import { type LinkProps, useNavigate } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { useUmami } from "@/hooks/use-umami";
import { authClient } from "@/lib/auth/auth-client";

export const useSignup = () => {
	const navigate = useNavigate();
	const { trackEvent } = useUmami();
	const route = "/select-organization" satisfies LinkProps["to"];
	return useMutationAction({
		mutationOptions: () => ({
			mutationFn: async (values: SignupSchemaType) => {
				const result = await authClient.signUp.email({
					name: values.name ?? "User",
					email: values.email,
					password: values.password,
					callbackURL: `${window.location.origin}${route}`,
					fetchOptions: {
						body: {
							invitationId: values.invitationId,
						},
					},
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
					to: route,
					replace: true,
				});
			},
		}),
		messages: {
			loading: "Creating your account...",
			success: "Your account is ready.",
			error: "Account creation failed",
		},
	});
};
