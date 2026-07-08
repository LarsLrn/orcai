import { useQueryClient } from "@tanstack/react-query";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";

export const useUpdateOrganizationMemberMutation = (
	opts: ReturnType<typeof orpc.organizationMember.update.mutationOptions> = {},
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.organizationMember.update.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.user.key(),
					});
					queryClient.invalidateQueries({
						queryKey: orpc.organizationMember.key(),
					});
					queryClient.invalidateQueries({
						queryKey: orpc.authorization.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useUpdateOrganizationMemberMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: "Updating role...",
			success: "Role updated",
			error: "Failed to update role",
		},
	});
};
