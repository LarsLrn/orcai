import type { EmailActionSchemaType } from "@orcai/schema";
import type { LinkProps } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { authClient } from "@/lib/auth/auth-client";

export const useResendVerificationEmail = () =>
	useMutationAction({
		mutationOptions: () => ({
			mutationFn: async (value: EmailActionSchemaType) => {
				const result = await authClient.sendVerificationEmail({
					email: value.email,
					callbackURL: "/select-organization" satisfies LinkProps["to"],
				});
				if (result.error) throw new Error(result.error.message);
				return result;
			},
		}),
		messages: {
			loading: "Sending verification email...",
			success:
				"If an account exists for that address, a verification email has been sent.",
			error: "Unable to resend verification email",
		},
	});
