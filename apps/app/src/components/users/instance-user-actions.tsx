import { INSTANCE_ADMIN_ROLE, INSTANCE_DEFAULT_ROLE } from "@orcai/core";
import type { InstanceUser } from "@orcai/schema";
import {
	BanIcon,
	KeyRoundIcon,
	ShieldCheckIcon,
	ShieldOffIcon,
	Trash2Icon,
	UndoIcon,
} from "lucide-react";
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
import {
	useBanUserMutation,
	useDeleteUsersMutation,
	useResetTwoFactorMutation,
	useSetInstanceRoleMutation,
	useUnbanUserMutation,
} from "@/hooks/mutations/use-user-admin-mutations";
import { isInstanceAdminRole } from "@/lib/authz/instance-role";
import { m } from "@/paraglide/messages";

/** What an instance admin can do to an account; nothing for their own. */
export const useInstanceUserActions = (
	user: Pick<
		InstanceUser,
		"id" | "email" | "banned" | "role" | "twoFactorEnabled"
	>,
	options: {
		onDeleted?: () => void;
	} = {},
): HeaderAction[] => {
	const { auth } = useAuthenticatedRouteContext();
	const target = {
		names: [
			user.email,
		],
	};
	const banUser = useBanUserMutation({}, target);
	const unbanUser = useUnbanUserMutation();
	const deleteUsers = useDeleteUsersMutation(
		{
			onSuccess: options.onDeleted,
		},
		target,
	);
	const resetTwoFactor = useResetTwoFactorMutation({}, target);
	const setInstanceRole = useSetInstanceRoleMutation({}, target);

	if (user.id === auth.user.id) {
		return [];
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
			onClick: () =>
				deleteUsers.mutate({
					userIds: [
						user.id,
					],
				}),
		},
	];
	return actions.filter((action) => action !== false);
};

/** The same actions as a table row's `…` menu. */
export const InstanceUserRowMenu = ({ user }: { user: InstanceUser }) => {
	const actions = useInstanceUserActions(user);
	if (actions.length === 0) {
		return null;
	}
	const regular = actions.filter((action) => !action.destructive);
	const destructive = actions.filter((action) => action.destructive);

	return (
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
	);
};
