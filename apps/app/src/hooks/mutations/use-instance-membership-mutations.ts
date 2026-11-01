import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const useAddInstanceMemberMutation = (
	opts: ReturnType<typeof orpc.instance.addMember.mutationOptions> = {},
) =>
	useMutationAction({
		mutationOptions: () => orpc.instance.addMember.mutationOptions(opts),
		messages: {
			loading: m.instance_org_member_add_toast_loading(),
			success: m.instance_org_member_add_toast_success(),
			error: m.instance_org_member_add_toast_error(),
		},
	});

export const useChangeInstanceMemberRoleMutation = () =>
	useMutationAction({
		mutationOptions: () => orpc.instance.changeMemberRole.mutationOptions(),
		messages: {
			loading: m.instance_org_member_role_toast_loading(),
			success: m.instance_org_member_role_toast_success(),
			error: m.instance_org_member_role_toast_error(),
		},
	});

export const useRemoveInstanceMemberMutation = () =>
	useMutationAction({
		mutationOptions: () => orpc.instance.removeMember.mutationOptions(),
		messages: {
			loading: m.instance_org_member_remove_toast_loading(),
			success: m.instance_org_member_remove_toast_success(),
			error: m.instance_org_member_remove_toast_error(),
		},
	});

export const useInviteInstanceMemberMutation = (
	opts: ReturnType<typeof orpc.instance.inviteMember.mutationOptions> = {},
) =>
	useMutationAction({
		mutationOptions: () => orpc.instance.inviteMember.mutationOptions(opts),
		messages: {
			loading: m.instance_org_member_invite_toast_loading(),
			success: m.instance_org_member_invite_toast_success(),
			error: m.instance_org_member_invite_toast_error(),
		},
	});
