import { ORGANIZATION_ADMIN_ROLE } from "@orcai/core";
import type { UserWithOrganizationRole } from "@orcai/schema";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import {
	KeyRoundIcon,
	MailCheckIcon,
	ShieldAlertIcon,
	UserCogIcon,
	UserMinusIcon,
} from "lucide-react";
import { useMemo } from "react";
import { OrganizationRolePicker } from "@/components/organizations/organization-role-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { useForgotPassword } from "@/hooks/mutations/use-forgot-password";
import {
	useDeleteOrganizationMembersMutation,
	useUpdateOrganizationMemberMutation,
} from "@/hooks/mutations/use-organization-member-mutations";
import { useResendVerificationEmail } from "@/hooks/mutations/use-resend-verification-email";
import { getAssignableOrganizationRoles } from "@/lib/authz/organization-role-metadata";

const ManageUser = ({ user }: { user: UserWithOrganizationRole }) => {
	const { auth } = useRouteContext({
		from: "/app",
	});
	const { data: capabilities } = useOrganizationCapabilities([
		"manage_organization",
	]);
	const navigate = useNavigate();
	const { mutate: requestPasswordReset } = useForgotPassword();
	const { mutate: resendVerificationEmail } = useResendVerificationEmail();
	const updateMember = useUpdateOrganizationMemberMutation();
	const removeMember = useDeleteOrganizationMembersMutation();
	const organizationId = auth.session.activeOrganizationId;
	const canManageOrganization =
		capabilities?.data.capabilities.manage_organization === true;
	const canManageProtectedUser =
		user.organizationRole !== ORGANIZATION_ADMIN_ROLE || canManageOrganization;
	const canMutateUserAccount =
		canManageProtectedUser && user.id !== auth.user.id;
	const isProtectedAdmin =
		user.organizationRole === ORGANIZATION_ADMIN_ROLE && !canManageOrganization;

	const handleRemoveFromOrganisation = async () => {
		if (!organizationId) {
			return;
		}

		const result = await removeMember.mutateAsync({
			organizationId,
			refs: [
				{
					userId: user.id,
				},
			],
		});

		if (result.status === "success") {
			await navigate({
				to: "/app/users",
			});
		}
	};

	const assignableRoles = useMemo(
		() =>
			getAssignableOrganizationRoles({
				canManageOrganization,
			}),
		[
			canManageOrganization,
		],
	);

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
					{canMutateUserAccount ? (
						<div className="flex flex-wrap gap-2">
							<Button
								variant="outline"
								onClick={() =>
									requestPasswordReset({
										email: user.email,
									})
								}
							>
								<KeyRoundIcon className="h-4 w-4" />
								Send Password Reset
							</Button>
							{!user.emailVerified ? (
								<Button
									variant="outline"
									onClick={() =>
										resendVerificationEmail({
											email: user.email,
										})
									}
								>
									<MailCheckIcon className="h-4 w-4" />
									Send Verification Email
								</Button>
							) : null}
						</div>
					) : null}
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

					{canMutateUserAccount && organizationId ? (
						<div className="flex flex-wrap gap-2">
							<Button
								variant="destructive"
								disabled={removeMember.isPending}
								onClick={() => void handleRemoveFromOrganisation()}
							>
								<UserMinusIcon className="h-4 w-4" />
								Remove from organisation
							</Button>
						</div>
					) : null}
				</CardContent>
			</Card>
		</div>
	);
};

export { ManageUser };
