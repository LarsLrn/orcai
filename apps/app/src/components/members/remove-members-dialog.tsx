import type { UserId } from "@orcai/core";
import { HandOverConfirmDialog } from "@/components/ownership/hand-over-confirm-dialog";
import { useDeleteOrganizationMembersMutation } from "@/hooks/mutations/use-organization-member-mutations";
import { m } from "@/paraglide/messages";

/** Confirms removing members from the active organisation and picks who receives what they own. */
export const RemoveMembersDialog = ({
	members,
	open,
	onOpenChange,
	onRemoved,
}: {
	members: {
		id: UserId;
		email: string;
	}[];
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onRemoved?: () => void | Promise<void>;
}) => {
	const removeMembers = useDeleteOrganizationMembersMutation();
	const count = members.length;
	const [only] = members;

	return (
		<HandOverConfirmDialog
			open={open}
			onOpenChange={onOpenChange}
			title={
				count === 1 && only
					? m.orgs_member_delete_confirm_title_named({
							name: only.email,
						})
					: m.orgs_member_delete_confirm_title({
							count,
						})
			}
			description={m.orgs_member_delete_confirm_description({
				count,
			})}
			confirmText={m.common_remove_button()}
			scope={{
				kind: "active-organization",
			}}
			userIds={members.map((member) => member.id)}
			pending={removeMembers.isPending}
			onConfirm={async ([receiver]) => {
				const result = await removeMembers.mutateAsync({
					refs: members.map((member) => ({
						userId: member.id,
					})),
					receiverId: receiver?.userId,
				});
				if (result.status === "success") {
					onOpenChange(false);
					await onRemoved?.();
				}
			}}
		/>
	);
};
