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
import { useMemo, useState } from "react";
import { RemoveMembersDialog } from "@/components/members/remove-members-dialog";
import { OrganizationRolePicker } from "@/components/organizations/organization-role-picker";
import { useRoleChange } from "@/components/ownership/use-role-change";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { useForgotPassword } from "@/hooks/mutations/use-forgot-password";
import { useUpdateOrganizationMemberMutation } from "@/hooks/mutations/use-organization-member-mutations";
import { useResendVerificationEmail } from "@/hooks/mutations/use-resend-verification-email";
import { getAssignableOrganizationRoles } from "@/lib/authz/organization-role-metadata";
import { m } from "@/paraglide/messages";

const ManageMember = ({ member }: { member: UserWithOrganizationRole }) => {
	const { auth } = useRouteContext({
		from: "/app",
	});
	const { data: capabilities } = useOrganizationCapabilities([
		"manage_organization",
	]);
	const navigate = useNavigate();
	const passwordReset = useForgotPassword();
	const verificationEmail = useResendVerificationEmail();
	const updateMember = useUpdateOrganizationMemberMutation();
	const roleChange = useRoleChange({
		scope: {
			kind: "active-organization",
		},
		member,
		change: (role, receiverId) =>
			updateMember.mutateAsync({
				userId: member.id,
				role,
				receiverId,
			}),
		pending: updateMember.isPending,
	});
	const [isRemoveOpen, setIsRemoveOpen] = useState(false);
	const canManageOrganization =
		capabilities?.data.capabilities.manage_organization === true;
	const canManageProtectedMember =
		member.organizationRole !== ORGANIZATION_ADMIN_ROLE ||
		canManageOrganization;
	const canMutateUserAccount =
		canManageProtectedMember && member.id !== auth.user.id;
	const isProtectedAdmin =
		member.organizationRole === ORGANIZATION_ADMIN_ROLE &&
		!canManageOrganization;

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
							{m.members_manage_card_title()}
						</CardTitle>
						{member.banned && (
							<Badge variant="destructive" className="gap-1">
								<ShieldAlertIcon className="h-3 w-3" />
								{m.members_manage_banned_badge()}
							</Badge>
						)}
					</div>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					{canMutateUserAccount ? (
						<div className="flex flex-wrap gap-2">
							<Button
								variant="outline"
								loading={passwordReset.isPending}
								onClick={() =>
									passwordReset.mutate({
										email: member.email,
									})
								}
							>
								<KeyRoundIcon className="h-4 w-4" />
								{m.members_manage_password_reset_action()}
							</Button>
							{!member.emailVerified ? (
								<Button
									variant="outline"
									loading={verificationEmail.isPending}
									onClick={() =>
										verificationEmail.mutate({
											email: member.email,
										})
									}
								>
									<MailCheckIcon className="h-4 w-4" />
									{m.members_manage_resend_verification_action()}
								</Button>
							) : null}
						</div>
					) : null}
					<div className="max-w-sm space-y-2">
						<p className="font-medium text-sm">
							{m.members_organisation_role_label()}
						</p>
						<OrganizationRolePicker
							value={member.organizationRole}
							onValueChange={(nextRole) => void roleChange.request(nextRole)}
							variant="full"
							disabled={updateMember.isPending || isProtectedAdmin}
							title={m.members_manage_role_picker_title()}
							roles={assignableRoles}
						/>
					</div>

					{canMutateUserAccount ? (
						<div className="flex flex-wrap gap-2">
							<Button
								variant="destructive"
								onClick={() => setIsRemoveOpen(true)}
							>
								<UserMinusIcon className="h-4 w-4" />
								{m.members_remove_from_organisation_action()}
							</Button>
						</div>
					) : null}
				</CardContent>
			</Card>
			{roleChange.dialog}
			{canMutateUserAccount ? (
				<RemoveMembersDialog
					members={[
						member,
					]}
					open={isRemoveOpen}
					onOpenChange={setIsRemoveOpen}
					onRemoved={() =>
						navigate({
							to: "/app/members",
						})
					}
				/>
			) : null}
		</div>
	);
};

export { ManageMember };
