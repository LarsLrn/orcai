import type { OrganizationId, OrganizationRole } from "@orcai/core";
import type { InstanceUser } from "@orcai/schema";
import { useId, useState } from "react";
import { InstanceUserPicker } from "@/components/instance/instance-user-picker";
import { OrganizationRolePicker } from "@/components/organizations/organization-role-picker";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
	useAddInstanceMemberMutation,
	useInviteInstanceMemberMutation,
} from "@/hooks/mutations/use-instance-membership-mutations";
import { m } from "@/paraglide/messages";

type DialogProps = {
	organizationId: OrganizationId;
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

const RoleField = ({
	role,
	onRoleChange,
}: {
	role: OrganizationRole;
	onRoleChange: (role: OrganizationRole) => void;
}) => (
	<Field>
		<FieldLabel>{m.instance_detail_role_column_header()}</FieldLabel>
		<OrganizationRolePicker
			value={role}
			onValueChange={onRoleChange}
			variant="full"
		/>
	</Field>
);

/** Adds an existing account to the organisation with a role. */
export const AddMemberDialog = ({
	organizationId,
	open,
	onOpenChange,
}: DialogProps) => {
	const [user, setUser] = useState<InstanceUser | null>(null);
	const [role, setRole] = useState<OrganizationRole>("member");
	const addMember = useAddInstanceMemberMutation({
		onSuccess: () => {
			setUser(null);
			onOpenChange(false);
		},
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{m.instance_org_member_add_title()}</DialogTitle>
					<DialogDescription>
						{m.instance_org_member_add_description()}
					</DialogDescription>
				</DialogHeader>
				<InstanceUserPicker value={user} onChange={setUser} />
				<RoleField role={role} onRoleChange={setRole} />
				<DialogFooter>
					<Button
						disabled={!user}
						loading={addMember.isPending}
						onClick={() =>
							user &&
							addMember.mutate({
								organizationId,
								userId: user.id,
								role,
							})
						}
					>
						{m.instance_org_member_add_action()}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

/** Invites someone by email with a role; refused for an existing member. */
export const InviteMemberDialog = ({
	organizationId,
	open,
	onOpenChange,
}: DialogProps) => {
	const id = useId();
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<OrganizationRole>("member");
	const invite = useInviteInstanceMemberMutation({
		onSuccess: () => {
			setEmail("");
			onOpenChange(false);
		},
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{m.instance_org_member_invite_title()}</DialogTitle>
					<DialogDescription>
						{m.instance_org_member_invite_description()}
					</DialogDescription>
				</DialogHeader>
				<form
					id={`${id}-form`}
					className="flex flex-col gap-4"
					onSubmit={(event) => {
						event.preventDefault();
						invite.mutate({
							organizationId,
							email: email.trim(),
							role,
						});
					}}
				>
					<Field>
						<FieldLabel htmlFor={`${id}-email`}>
							{m.common_email_label()}
						</FieldLabel>
						<Input
							id={`${id}-email`}
							type="email"
							required
							value={email}
							onChange={(event) => setEmail(event.target.value)}
						/>
					</Field>
					<RoleField role={role} onRoleChange={setRole} />
				</form>
				<DialogFooter>
					<Button type="submit" form={`${id}-form`} loading={invite.isPending}>
						{m.instance_org_member_invite_action()}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
