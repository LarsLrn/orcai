import type { UseMutationOptions } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { authClient } from "@/lib/auth/auth-client";
import { orpc } from "@/lib/orpc/orpc";

type DeleteUsersInput = {
	userIds: string[];
};

type DeleteUsersResult = {
	success: true;
	deletedCount: number;
};

type DeleteUsersMutationOptions = UseMutationOptions<
	DeleteUsersResult,
	Error,
	DeleteUsersInput,
	unknown
>;

export const useDeleteUsersMutation = (
	opts: DeleteUsersMutationOptions = {},
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () => ({
			...opts,
			mutationFn: async ({ userIds }: DeleteUsersInput) => {
				const uniqueUserIds = new Set(userIds);
				if (userIds.length === 0) {
					throw new Error("Please select at least one user");
				}

				if (uniqueUserIds.size !== userIds.length) {
					throw new Error("Selected users must be unique");
				}

				const results = [];
				for (const userId of userIds) {
					results.push(
						await authClient.admin.removeUser({
							userId,
						}),
					);
				}

				for (const result of results) {
					if (result.error) {
						throw new Error(result.error.message);
					}
				}

				return {
					success: true,
					deletedCount: userIds.length,
				} as const;
			},
			onSuccess: async (...args) => {
				queryClient.invalidateQueries({
					queryKey: orpc.user.key(),
				});

				try {
					await opts.onSuccess?.(...args);
				} catch (error) {
					console.error(
						"useDeleteUsersMutation onSuccess callback failed:",
						error,
					);
				}
			},
		}),
		messages: {
			loading: "Deleting users...",
			success: "Users deleted",
			error: "Failed to delete users",
		},
		confirm: (input) => {
			const count = input.userIds.length;
			const plural = count === 1 ? "" : "s";

			return {
				title: `Delete User${plural}`,
				description: `Are you sure you want to delete ${count} user${plural}? This action cannot be undone.`,
				confirmText: "Delete",
				cancelText: "Cancel",
			};
		},
	});
};
