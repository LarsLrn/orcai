import type { EmailActionSchemaType } from "@orcai/schema";
import type { LinkProps } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { authClient } from "@/lib/auth/auth-client";
import { m } from "@/paraglide/messages";

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
			loading: m.auth_resend_verification_toast_loading(),
			success: m.auth_resend_verification_toast_success(),
			error: m.auth_resend_verification_toast_error(),
		},
	});
