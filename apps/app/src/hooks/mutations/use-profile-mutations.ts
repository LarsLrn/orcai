import type { UseMutationOptions } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { authClient } from "@/lib/auth/auth-client";
import { toAuthError } from "@/lib/errors/auth-error";
import { m } from "@/paraglide/messages";

type UpdateProfileInput = {
	name: string;
};
type UpdateProfileMutationOptions = UseMutationOptions<
	void,
	unknown,
	UpdateProfileInput,
	unknown
>;

export const useUpdateProfileMutation = (
	opts: UpdateProfileMutationOptions = {},
) => {
	const router = useRouter();

	return useMutationAction({
		mutationOptions: () => ({
			...opts,
			mutationFn: async (values: UpdateProfileInput) => {
				const result = await authClient.updateUser({
					name: values.name,
				});
				if (result.error) throw toAuthError(result.error);
			},
			onSuccess: async (...args) => {
				// The signed-in user is read from the router context.
				await router.invalidate();

				await opts.onSuccess?.(...args);
			},
		}),
		messages: {
			loading: m.account_profile_toast_loading(),
			success: m.account_profile_toast_success(),
			error: m.account_profile_toast_error(),
		},
	});
};
