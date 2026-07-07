import type { EmailActionSchemaType } from "@orcai/schema";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { authClient } from "@/lib/auth/auth-client";

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
			loading: "Requesting password reset...",
			success:
				"If an account exists for that address, a password reset email has been sent.",
			error: "Unable to request a password reset",
		},
	});
