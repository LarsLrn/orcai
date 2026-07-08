import type { UserWithOrganizationRole } from "@orcai/schema";
import { useRouteContext } from "@tanstack/react-router";
import {
	ShieldAlertIcon,
	ShieldCheckIcon,
	Trash2Icon,
	UserCogIcon,
	UserXIcon,
} from "lucide-react";
import { useMemo } from "react";
import { toast } from "sonner";
import { OrganizationRolePicker } from "@/components/organizations/organization-role-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { useUpdateOrganizationMemberMutation } from "@/hooks/mutations/use-organization-member-mutations";
import { useDeleteUsersMutation } from "@/hooks/mutations/use-user-admin-mutations";
import { authClient } from "@/lib/auth/auth-client";
import { getAssignableOrganizationRoles } from "@/lib/authz/organization-role-metadata";

const ManageUser = ({ user }: { user: UserWithOrganizationRole }) => {
	const { auth } = useRouteContext({
		from: "/app",
	});
	const { data: capabilities } = useOrganizationCapabilities([
		"manage_organization",
	]);
	const { mutate: deleteUsers } = useDeleteUsersMutation();
	const updateMember = useUpdateOrganizationMemberMutation();
	const organizationId = auth.session.activeOrganizationId;
	const canManageOrganization =
		capabilities?.data.capabilities.manage_organization === true;
	const canManageProtectedUser =
		user.organizationRole !== "admin" || canManageOrganization;
	const canMutateUserAccount =
		canManageProtectedUser && user.id !== auth.user.id;
	const isProtectedAdmin =
		user.organizationRole === "admin" && !canManageOrganization;

	const assignableRoles = useMemo(
		() =>
			getAssignableOrganizationRoles({
				canManageOrganization,
			}),
		[
			canManageOrganization,
		],
	);

	const handleBanUser = (userId: string) => {
		toast.promise(
			authClient.admin.banUser({
				userId,
			}),
			{
				loading: "Banning user...",
				success: "User banned",
				error: (error) => ({
					message: "Failed to ban user",
					description: error.message,
				}),
			},
		);
	};

	const handleUnbanUser = (userId: string) => {
		toast.promise(
			authClient.admin.unbanUser({
				userId,
			}),
			{
				loading: "Unbanning user...",
				success: "User unbanned",
				error: (error) => ({
					message: "Failed to unban user",
					description: error.message,
				}),
			},
		);
	};

	const handleDeleteUser = (userId: string) => {
		deleteUsers({
			userIds: [
				userId,
			],
		});
	};

	return (
		<div className="flex flex-col gap-4">
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle className="flex items-center gap-2">
							<UserCogIcon className="h-5 w-5 text-primary" />
							User Management
						</CardTitle>
						{user.banned && (
							<Badge variant="destructive" className="gap-1">
								<ShieldAlertIcon className="h-3 w-3" />
								Banned
							</Badge>
						)}
					</div>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<div className="max-w-sm space-y-2">
						<p className="font-medium text-sm">Organisation Role</p>
						<OrganizationRolePicker
							value={user.organizationRole}
							onValueChange={(nextRole) => {
								if (!organizationId) {
									return;
								}

								updateMember.mutate({
									organizationId,
									userId: user.id,
									role: nextRole,
								});
							}}
							variant="full"
							disabled={
								updateMember.isPending || !organizationId || isProtectedAdmin
							}
							title="Change organization role"
							roles={assignableRoles}
						/>
					</div>

					{canMutateUserAccount ? (
						<div className="flex flex-wrap gap-2">
							{!user.banned ? (
								<Button
									variant="destructive"
									onClick={() => handleBanUser(user.id)}
								>
									<UserXIcon className="h-4 w-4" />
									Ban User
								</Button>
							) : (
								<Button onClick={() => handleUnbanUser(user.id)}>
									<ShieldCheckIcon className="h-4 w-4" />
									Unban User
								</Button>
							)}

							<Button
								variant="destructive"
								onClick={() => handleDeleteUser(user.id)}
							>
								<Trash2Icon className="h-4 w-4" />
								Delete User
							</Button>
						</div>
					) : null}
				</CardContent>
			</Card>
		</div>
	);
};

export { ManageUser };
