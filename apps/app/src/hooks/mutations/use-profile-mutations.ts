import { useRouter } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { authClient } from "@/lib/auth/auth-client";
import { toAuthError } from "@/lib/errors/auth-error";
import { m } from "@/paraglide/messages";

type UpdateProfileInput = {
	name: string;
};

export const useUpdateProfileMutation = () => {
	const router = useRouter();

	return useMutationAction({
		mutationOptions: () => ({
			mutationFn: async (values: UpdateProfileInput) => {
				const result = await authClient.updateUser({
					name: values.name,
				});
				if (result.error) throw toAuthError(result.error);
			},
			// The signed-in user is read from the router context.
			onSuccess: () => router.invalidate(),
		}),
		messages: {
			loading: m.account_profile_toast_loading(),
			success: m.account_profile_toast_success(),
			error: m.account_profile_toast_error(),
		},
	});
};
