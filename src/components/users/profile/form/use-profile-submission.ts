import { useFormSubmission } from "@/hooks/form/use-form-submission";
import { authClient } from "@/lib/auth-client";

export const useProfileFormSubmission = () => {
	const { refetch } = authClient.useSession();

	const update = useFormSubmission({
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

	return { update };
};
