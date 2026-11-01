import { INSTANCE_ADMIN_ROLE, INSTANCE_DEFAULT_ROLE } from "@orcai/core";
import type { InstanceUser } from "@orcai/schema";
import {
	BanIcon,
	ImageOffIcon,
	KeyRoundIcon,
	ShieldCheckIcon,
	ShieldOffIcon,
	Trash2Icon,
	UndoIcon,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { HandOverConfirmDialog } from "@/components/ownership/hand-over-confirm-dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	type HeaderAction,
	OverflowMenuTrigger,
} from "@/components/ui/shell/actions";
import { useAuthenticatedRouteContext } from "@/hooks/authz/use-authenticated-route-context";
import { useRemoveUserImageMutation } from "@/hooks/mutations/use-instance-image-mutations";
import {
	useBanUserMutation,
	useDeleteUsersMutation,
	useResetTwoFactorMutation,
	useSetInstanceRoleMutation,
	useUnbanUserMutation,
} from "@/hooks/mutations/use-user-admin-mutations";
import { isInstanceAdminRole } from "@/lib/authz/instance-role";
import { m } from "@/paraglide/messages";

/**
 * What an instance admin can do to an account, nothing for their own, with
 * the dialog that confirms deleting it.
 */
export const useInstanceUserActions = (
	user: Pick<
		InstanceUser,
		"id" | "name" | "email" | "image" | "banned" | "role" | "twoFactorEnabled"
	>,
	options: {
		onDeleted?: () => void;
	} = {},
): {
	actions: HeaderAction[];
	dialog: ReactNode;
} => {
	const { auth } = useAuthenticatedRouteContext();
	const target = {
		names: [
			user.email,
		],
	};
	const banUser = useBanUserMutation({}, target);
	const unbanUser = useUnbanUserMutation();
	const deleteUsers = useDeleteUsersMutation();
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);
	const resetTwoFactor = useResetTwoFactorMutation({}, target);
	const setInstanceRole = useSetInstanceRoleMutation({}, target);
	const removeImage = useRemoveUserImageMutation({
		name: user.name,
	});

	if (user.id === auth.user.id) {
		return {
			actions: [],
			dialog: null,
		};
	}

	const actions: (HeaderAction | false)[] = [
		user.twoFactorEnabled && {
			key: "reset-two-factor",
			label: m.instance_users_table_reset_two_factor_menu_item(),
			icon: KeyRoundIcon,
			overflow: true,
			onClick: () =>
				resetTwoFactor.mutate({
					userId: user.id,
				}),
		},
		isInstanceAdminRole(user.role)
			? {
					key: "instance-role",
					label: m.instance_users_table_demote_menu_item(),
					icon: ShieldOffIcon,
					overflow: true,
					onClick: () =>
						setInstanceRole.mutate({
							userId: user.id,
							role: INSTANCE_DEFAULT_ROLE,
						}),
				}
			: {
					key: "instance-role",
					label: m.instance_users_table_promote_menu_item(),
					icon: ShieldCheckIcon,
					overflow: true,
					onClick: () =>
						setInstanceRole.mutate({
							userId: user.id,
							role: INSTANCE_ADMIN_ROLE,
						}),
				},
		Boolean(user.image) && {
			key: "remove-picture",
			label: m.images_picture_remove_button(),
			icon: ImageOffIcon,
			overflow: true,
			onClick: () =>
				removeImage.mutate({
					id: user.id,
				}),
		},
		user.banned
			? {
					key: "ban",
					label: m.instance_users_table_unban_menu_item(),
					icon: UndoIcon,
					overflow: true,
					onClick: () =>
						unbanUser.mutate({
							userId: user.id,
						}),
				}
			: {
					key: "ban",
					label: m.instance_users_table_ban_menu_item(),
					icon: BanIcon,
					destructive: true,
					onClick: () =>
						banUser.mutate({
							userId: user.id,
						}),
				},
		{
			key: "delete",
			label: m.instance_users_table_delete_menu_item(),
			icon: Trash2Icon,
			destructive: true,
			onClick: () => setIsDeleteOpen(true),
		},
	];
	return {
		actions: actions.filter((action) => action !== false),
		dialog: (
			<HandOverConfirmDialog
				open={isDeleteOpen}
				onOpenChange={setIsDeleteOpen}
				title={m.users_delete_confirm_title_named({
					name: user.email,
				})}
				description={m.users_delete_confirm_description({
					count: 1,
				})}
				confirmText={m.common_delete_button()}
				scope={{
					kind: "instance",
				}}
				userIds={[
					user.id,
				]}
				pending={deleteUsers.isPending}
				onConfirm={async (receivers) => {
					const result = await deleteUsers.mutateAsync({
						userIds: [
							user.id,
						],
						receivers,
					});
					if (result.status === "success") {
						setIsDeleteOpen(false);
						options.onDeleted?.();
					}
				}}
			/>
		),
	};
};

/** The same actions as a table row's `…` menu. */
export const InstanceUserRowMenu = ({ user }: { user: InstanceUser }) => {
	const { actions, dialog } = useInstanceUserActions(user);
	if (actions.length === 0) {
		return null;
	}
	const regular = actions.filter((action) => !action.destructive);
	const destructive = actions.filter((action) => action.destructive);

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger render={<OverflowMenuTrigger variant="ghost" />} />
				<DropdownMenuContent align="end">
					{regular.map((action) => (
						<DropdownMenuItem key={action.key} onClick={action.onClick}>
							{action.label}
						</DropdownMenuItem>
					))}
					<DropdownMenuSeparator />
					{destructive.map((action) => (
						<DropdownMenuItem
							key={action.key}
							variant="destructive"
							onClick={action.onClick}
						>
							{action.label}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
			{dialog}
		</>
	);
};
