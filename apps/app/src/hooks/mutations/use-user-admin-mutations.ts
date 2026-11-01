import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import {
	type DestructiveTarget,
	singleTargetName,
} from "@/hooks/mutations/destructive-target";
import { isInstanceAdminRole } from "@/lib/authz/instance-role";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

/** Deletes accounts; the dialog confirms and picks who receives what they own. */
export const useDeleteUsersMutation = (
	opts: ReturnType<typeof orpc.user.delete.mutationOptions> = {},
) =>
	useMutationAction({
		mutationOptions: () => orpc.user.delete.mutationOptions(opts),
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
	});

export const useBanUserMutation = (
	opts: ReturnType<typeof orpc.user.ban.mutationOptions> = {},
	target?: DestructiveTarget,
) => {
	const name = singleTargetName(1, target);

	return useMutationAction({
		mutationOptions: () => orpc.user.ban.mutationOptions(opts),
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
	return useMutationAction({
		mutationOptions: () => orpc.user.unban.mutationOptions(opts),
		messages: {
			loading: m.users_unban_toast_loading(),
			success: m.users_unban_toast_success(),
			error: m.users_unban_toast_error(),
		},
	});
};

export const useResetTwoFactorMutation = (
	opts: ReturnType<typeof orpc.user.resetTwoFactor.mutationOptions> = {},
	target?: DestructiveTarget,
) => {
	const name = singleTargetName(1, target);

	return useMutationAction({
		mutationOptions: () => orpc.user.resetTwoFactor.mutationOptions(opts),
		messages: {
			loading: m.users_reset_two_factor_toast_loading(),
			success: m.users_reset_two_factor_toast_success(),
			error: m.users_reset_two_factor_toast_error(),
		},
		confirm: {
			title: name
				? m.users_reset_two_factor_confirm_title_named({
						name,
					})
				: m.users_reset_two_factor_confirm_title(),
			description: m.users_reset_two_factor_confirm_description(),
			confirmText: m.users_reset_two_factor_confirm_button(),
			cancelText: m.common_cancel_button(),
		},
	});
};

export const useSetInstanceRoleMutation = (
	opts: ReturnType<typeof orpc.user.setInstanceRole.mutationOptions> = {},
	target?: DestructiveTarget,
) => {
	const name = singleTargetName(1, target);

	return useMutationAction({
		mutationOptions: () => orpc.user.setInstanceRole.mutationOptions(opts),
		messages: {
			loading: ({ input }) =>
				isInstanceAdminRole(input.role)
					? m.users_promote_toast_loading()
					: m.users_demote_toast_loading(),
			success: ({ input }) =>
				isInstanceAdminRole(input.role)
					? m.users_promote_toast_success()
					: m.users_demote_toast_success(),
			error: ({ input }) =>
				isInstanceAdminRole(input.role)
					? m.users_promote_toast_error()
					: m.users_demote_toast_error(),
		},
		confirm: (input) =>
			isInstanceAdminRole(input.role)
				? {
						title: name
							? m.users_promote_confirm_title_named({
									name,
								})
							: m.users_promote_confirm_title(),
						description: m.users_promote_confirm_description(),
						confirmText: m.users_promote_confirm_button(),
						cancelText: m.common_cancel_button(),
					}
				: {
						title: name
							? m.users_demote_confirm_title_named({
									name,
								})
							: m.users_demote_confirm_title(),
						description: m.users_demote_confirm_description(),
						confirmText: m.users_demote_confirm_button(),
						cancelText: m.common_cancel_button(),
					},
	});
};
