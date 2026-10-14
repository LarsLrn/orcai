import { useQueryClient } from "@tanstack/react-query";
import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import {
	type DestructiveTarget,
	singleTargetName,
} from "@/hooks/mutations/destructive-target";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

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
			loading: m.orgs_member_update_toast_loading(),
			success: m.orgs_member_update_toast_success(),
			error: m.orgs_member_update_toast_error(),
		},
	});
};

/** Removes memberships from the active organisation. The accounts stay. */
export const useDeleteOrganizationMembersMutation = (
	opts: ReturnType<typeof orpc.organizationMember.delete.mutationOptions> = {},
	target?: DestructiveTarget,
) => {
	const queryClient = useQueryClient();

	return useMutationAction({
		mutationOptions: () =>
			orpc.organizationMember.delete.mutationOptions({
				...opts,
				onSuccess: async (...args) => {
					queryClient.invalidateQueries({
						queryKey: orpc.user.key(),
					});
					queryClient.invalidateQueries({
						queryKey: orpc.organizationMember.key(),
					});

					try {
						await opts.onSuccess?.(...args);
					} catch (error) {
						console.error(
							"useDeleteOrganizationMembersMutation onSuccess callback failed:",
							error,
						);
					}
				},
			}),
		messages: {
			loading: ({ input }) =>
				m.orgs_member_delete_toast_loading({
					count: input.refs.length,
				}),
			success: ({ input }) =>
				m.orgs_member_delete_toast_success({
					count: input.refs.length,
				}),
			error: ({ input }) =>
				m.orgs_member_delete_toast_error({
					count: input.refs.length,
				}),
		},
		confirm: (input) => {
			const count = input.refs.length;
			const name = singleTargetName(count, target);

			return {
				title: name
					? m.orgs_member_delete_confirm_title_named({
							name,
						})
					: m.orgs_member_delete_confirm_title({
							count,
						}),
				description: m.orgs_member_delete_confirm_description({
					count,
				}),
				confirmText: m.common_remove_button(),
				cancelText: m.common_cancel_button(),
			};
		},
	});
};
