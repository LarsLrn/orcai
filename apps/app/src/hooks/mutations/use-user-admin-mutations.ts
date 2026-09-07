import { useQueryClient } from "@tanstack/react-query";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";

export const useDeleteUsersMutation = (
	opts: ReturnType<typeof orpc.user.delete.mutationOptions> = {},
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.user.delete.mutationOptions({
				...opts,
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
			loading: "Deleting accounts...",
			success: "Accounts deleted",
			error: "Failed to delete accounts",
		},
		confirm: (input) => {
			const count = input.userIds.length;
			const plural = count === 1 ? "" : "s";

			return {
				title: `Delete Account${plural}`,
				description: `Are you sure you want to delete ${count} account${plural}? The account leaves every organisation it belongs to. This action cannot be undone.`,
				confirmText: "Delete",
				cancelText: "Cancel",
			};
		},
	});
};

export const useBanUserMutation = (
	opts: ReturnType<typeof orpc.user.ban.mutationOptions> = {},
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.user.ban.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.user.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useBanUserMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: "Banning account...",
			success: "Account banned",
			error: "Failed to ban the account",
		},
		confirm: {
			title: "Ban Account",
			description:
				"A banned account cannot sign in until the ban is lifted. Its memberships stay in place.",
			confirmText: "Ban",
			cancelText: "Cancel",
		},
	});
};

export const useUnbanUserMutation = (
	opts: ReturnType<typeof orpc.user.unban.mutationOptions> = {},
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.user.unban.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.user.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useUnbanUserMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: "Lifting the ban...",
			success: "Ban lifted",
			error: "Failed to lift the ban",
		},
	});
};
