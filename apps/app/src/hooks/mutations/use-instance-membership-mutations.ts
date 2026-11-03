import { useMutationAction } from "@/hooks/actions/use-mutation-action";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

export const useAddInstanceMemberMutation = () =>
	useMutationAction({
		mutationOptions: () => orpc.instance.addMember.mutationOptions(),
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

export const useInviteInstanceMemberMutation = () =>
	useMutationAction({
		mutationOptions: () => orpc.instance.inviteMember.mutationOptions(),
		messages: {
			loading: m.instance_org_member_invite_toast_loading(),
			success: ({ data }) => {
				const [skipped] = data.skipped;
				if (!skipped) {
					return m.instance_org_member_invite_toast_success();
				}
				return skipped.reason === "member"
					? m.instance_org_member_invite_toast_member()
					: m.instance_org_member_invite_toast_pending();
			},
			error: m.instance_org_member_invite_toast_error(),
		},
	});
