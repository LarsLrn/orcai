import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const useUpdateOrganizationMemberMutation = (
	opts: ReturnType<typeof orpc.organizationMember.update.mutationOptions> = {},
) => {
	return useMutationAction({
		mutationOptions: () => orpc.organizationMember.update.mutationOptions(opts),
		messages: {
			loading: m.orgs_member_update_toast_loading(),
			success: m.orgs_member_update_toast_success(),
			error: m.orgs_member_update_toast_error(),
		},
	});
};

/**
 * Removes memberships from the active organisation. The accounts stay, and
 * the removal dialog confirms and picks who receives what they own.
 */
export const useDeleteOrganizationMembersMutation = (
	opts: ReturnType<typeof orpc.organizationMember.delete.mutationOptions> = {},
) =>
	useMutationAction({
		mutationOptions: () => orpc.organizationMember.delete.mutationOptions(opts),
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
	});
