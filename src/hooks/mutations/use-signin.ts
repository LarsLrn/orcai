import { useNavigate } from "@tanstack/react-router";
import type { SigninSchemaType } from "@/db/zod/signin";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { useUmami } from "@/hooks/use-umami";
import { authClient } from "@/lib/auth/auth-client";

export const useSignin = () => {
	const navigate = useNavigate();
	const { trackEvent } = useUmami();

	const signin = useMutationAction({
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

	return { signin };
};
