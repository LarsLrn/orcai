import type {
	DirectGrantOrigin,
	ResourceGrant,
	ResourceGrantRole,
} from "@orcai/schema";
import {
	ALL_MEMBERS_GROUP_SYSTEM_KEY,
	RESOURCE_GRANT_ORIGIN,
} from "@orcai/schema";
import { Trash2Icon, UsersIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OptionPicker } from "@/components/ui/composed/option-picker";
import { UserAvatar } from "@/components/users/user-avatar";
import { m } from "@/paraglide/messages";
import {
	getResourceRoleLabel,
	getResourceRoleOptions,
} from "@/settings/display-config";

const originLabel = (origin: DirectGrantOrigin) =>
	({
		[RESOURCE_GRANT_ORIGIN.DIRECT_USER]:
			m.access_grant_row_origin_direct_user(),
		[RESOURCE_GRANT_ORIGIN.DIRECT_GROUP]:
			m.access_grant_row_origin_direct_group(),
		[RESOURCE_GRANT_ORIGIN.DIRECT_GROUP_ALL_MEMBERS]:
			m.access_grant_row_origin_all_members(),
	})[origin];

const GrantEditorRow = ({
	grant,
	disabled,
	onChangeRole,
	onRevoke,
}: {
	grant: ResourceGrant;
	disabled?: boolean;
	/** Without it the role is fixed. */
	onChangeRole?: (role: ResourceGrantRole) => void;
	onRevoke: () => void;
}) => {
	const isAllMembers =
		grant.principal.type === "group" &&
		grant.principal.kind === "system" &&
		grant.principal.systemKey === ALL_MEMBERS_GROUP_SYSTEM_KEY;

	return (
		<li className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
			<div className="flex min-w-0 items-center gap-3">
				{grant.principal.type === "user" ? (
					<UserAvatar user={grant.principal} size="sm" />
				) : (
					<div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
						<UsersIcon className="h-4 w-4" />
					</div>
				)}
				<div className="min-w-0">
					<div className="flex items-center gap-2">
						<p className="truncate font-medium text-sm">
							{grant.principal.name}
						</p>
						<Badge variant="outline">{originLabel(grant.origin)}</Badge>
					</div>
					<p className="truncate text-muted-foreground text-xs">
						{grant.principal.type === "user"
							? grant.principal.email
							: grant.principal.description ||
								m.access_grant_row_group_fallback()}
					</p>
				</div>
			</div>

			<div className="flex items-center gap-2">
				{isAllMembers || !onChangeRole ? (
					<Badge variant="outline" className="capitalize">
						{getResourceRoleLabel(grant.role)}
					</Badge>
				) : (
					<OptionPicker
						options={getResourceRoleOptions()}
						value={grant.role}
						onChange={onChangeRole}
						disabled={disabled}
						className="w-32"
					/>
				)}
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={onRevoke}
					disabled={disabled}
					className="text-destructive"
				>
					<Trash2Icon className="h-4 w-4" />
					<span className="sr-only">
						{m.access_grant_row_revoke_aria_label()}
					</span>
				</Button>
			</div>
		</li>
	);
};

export { GrantEditorRow };
