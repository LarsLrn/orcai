import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { authClient } from "@/lib/auth/auth-client";

export const useProfileMutations = () => {
	const { refetch } = authClient.useSession();

	const updateProfile = useMutationAction({
		mutationOptions: () => ({
			mutationFn: async (values: { name: string }) => {
				await authClient.updateUser({
					name: values.name,
				});
			},
		}),
		messages: {
			loading: "Saving profile...",
			success: "Profile updated successfully!",
			error: "Failed to update profile",
		},
		onSuccess: () => refetch(),
	});

	return { updateProfile };
};
