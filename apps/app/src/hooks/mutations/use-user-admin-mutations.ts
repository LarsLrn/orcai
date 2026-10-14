import { useQueryClient } from "@tanstack/react-query";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import {
	type DestructiveTarget,
	singleTargetName,
} from "@/hooks/mutations/destructive-target";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const useDeleteUsersMutation = (
	opts: ReturnType<typeof orpc.user.delete.mutationOptions> = {},
	target?: DestructiveTarget,
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
			loading: ({ input }) =>
				m.users_delete_toast_loading({
					count: input.userIds.length,
				}),
			success: ({ input }) =>
				m.users_delete_toast_success({
					count: input.userIds.length,
				}),
			error: ({ input }) =>
				m.users_delete_toast_error({
					count: input.userIds.length,
				}),
		},
		confirm: (input) => {
			const count = input.userIds.length;
			const name = singleTargetName(count, target);

			return {
				title: name
					? m.users_delete_confirm_title_named({
							name,
						})
					: m.users_delete_confirm_title({
							count,
						}),
				description: m.users_delete_confirm_description({
					count,
				}),
				confirmText: m.common_delete_button(),
				cancelText: m.common_cancel_button(),
			};
		},
	});
};

export const useBanUserMutation = (
	opts: ReturnType<typeof orpc.user.ban.mutationOptions> = {},
	target?: DestructiveTarget,
) => {
	const queryClient = useQueryClient();
	const name = singleTargetName(1, target);

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
			loading: m.users_ban_toast_loading(),
			success: m.users_ban_toast_success(),
			error: m.users_ban_toast_error(),
		},
		confirm: {
			title: name
				? m.users_ban_confirm_title_named({
						name,
					})
				: m.users_ban_confirm_title(),
			description: m.users_ban_confirm_description(),
			confirmText: m.users_ban_confirm_button(),
			cancelText: m.common_cancel_button(),
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
			loading: m.users_unban_toast_loading(),
			success: m.users_unban_toast_success(),
			error: m.users_unban_toast_error(),
		},
	});
};
