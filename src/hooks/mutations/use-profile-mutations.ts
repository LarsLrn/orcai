import type { UseMutationOptions } from "@tanstack/react-query";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { authClient } from "@/lib/auth/auth-client";

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
	const { refetch } = authClient.useSession();

	return useMutationAction({
		mutationOptions: () => ({
			...opts,
			mutationFn: async (values: UpdateProfileInput) => {
				await authClient.updateUser({
					name: values.name,
				});
			},
			onSuccess: async (...args) => {
				await refetch();

				try {
					await opts.onSuccess?.(...args);
				} catch (error) {
					console.error(
						"useUpdateProfileMutation onSuccess callback failed:",
						error,
					);
				}
			},
		}),
		messages: {
			loading: "Saving profile...",
			success: "Profile updated successfully!",
			error: "Failed to update profile",
		},
	});
};
