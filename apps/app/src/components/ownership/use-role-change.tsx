import type { OrganizationRole, UserId } from "@orcai/core";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { HandOverConfirmDialog } from "@/components/ownership/hand-over-confirm-dialog";
import {
	type MembershipScope,
	ownedContentQuery,
} from "@/components/ownership/membership-scope";
import { m } from "@/paraglide/messages";

/**
 * Changes a member's role. Making them a Viewer first asks who receives what
 * they own, when they own something.
 */
export const useRoleChange = ({
	scope,
	member,
	change,
	pending,
}: {
	scope: MembershipScope;
	member: {
		id: UserId;
		name: string;
	};
	change: (
		role: OrganizationRole,
		receiverId?: UserId,
	) => Promise<{
		status: string;
	}>;
	pending: boolean;
}) => {
	const queryClient = useQueryClient();
	const [isOpen, setIsOpen] = useState(false);
	// A later pick while the Viewer check reads owned content supersedes it.
	const latest = useRef(0);

	const request = async (role: OrganizationRole) => {
		const current = ++latest.current;
		if (role !== "viewer") {
			await change(role);
			return;
		}
		const owned = await queryClient
			.fetchQuery(
				ownedContentQuery(scope, [
					member.id,
				]),
			)
			.catch(() => undefined);
		if (current !== latest.current) return;
		if (owned?.data.length === 0) {
			await change(role);
			return;
		}
		setIsOpen(true);
	};

	return {
		request,
		dialog: (
			<HandOverConfirmDialog
				open={isOpen}
				onOpenChange={setIsOpen}
				title={m.ownership_viewer_confirm_title({
					name: member.name,
				})}
				description={m.ownership_viewer_confirm_description()}
				confirmText={m.ownership_viewer_confirm_button()}
				scope={scope}
				userIds={[
					member.id,
				]}
				pending={pending}
				onConfirm={async ([receiver]) => {
					const result = await change("viewer", receiver?.userId);
					if (result.status === "success") setIsOpen(false);
				}}
			/>
		),
	};
};
