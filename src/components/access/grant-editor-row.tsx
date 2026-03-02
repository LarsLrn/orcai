import { Trash2Icon, UsersIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OptionPicker } from "@/components/ui/composed/option-picker";
import type {
	ResourceGrant,
	ResourceGrantRole,
} from "@/lib/orpc/schemas/resource";
import {
	ALL_MEMBERS_GROUP_SYSTEM_KEY,
	RESOURCE_GRANT_SOURCE,
} from "@/lib/orpc/schemas/resource";
import { getInitial } from "@/lib/utils/text-utils";
import { ROLES } from "@/settings/display-config";

const sourceLabel: Record<ResourceGrant["source"], string> = {
	[RESOURCE_GRANT_SOURCE.DIRECT_USER]: "Direct user",
	[RESOURCE_GRANT_SOURCE.DIRECT_GROUP]: "Direct group",
	[RESOURCE_GRANT_SOURCE.DIRECT_GROUP_ALL_MEMBERS]: "All Members",
	[RESOURCE_GRANT_SOURCE.INHERITED_COURSE]: "Inherited from course",
	[RESOURCE_GRANT_SOURCE.INHERITED_BOT]: "Inherited from bot",
	[RESOURCE_GRANT_SOURCE.INHERITED_BLOCK]: "Inherited from block",
	[RESOURCE_GRANT_SOURCE.PUBLIC]: "Public",
};

const isDirectGrant = (grant: ResourceGrant) =>
	grant.source === RESOURCE_GRANT_SOURCE.DIRECT_USER ||
	grant.source === RESOURCE_GRANT_SOURCE.DIRECT_GROUP ||
	grant.source === RESOURCE_GRANT_SOURCE.DIRECT_GROUP_ALL_MEMBERS;

const GrantEditorRow = ({
	grant,
	disabled,
	onChangeRole,
	onRevoke,
}: {
	grant: ResourceGrant;
	disabled?: boolean;
	onChangeRole: (role: ResourceGrantRole) => void;
	onRevoke: () => void;
}) => {
	const isDirect = isDirectGrant(grant);
	const isAllMembers =
		grant.principal.type === "group" &&
		grant.principal.kind === "system" &&
		grant.principal.systemKey === ALL_MEMBERS_GROUP_SYSTEM_KEY;
	const canEditRole = isDirect && !isAllMembers;

	return (
		<div className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
			<div className="flex min-w-0 items-center gap-3">
				{grant.principal.type === "user" ? (
					<Avatar size="sm">
						<AvatarImage src={grant.principal.image ?? undefined} />
						<AvatarFallback>{getInitial(grant.principal.name)}</AvatarFallback>
					</Avatar>
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
						<Badge variant="outline" className="text-[10px]">
							{sourceLabel[grant.source]}
						</Badge>
					</div>
					<p className="truncate text-muted-foreground text-xs">
						{grant.principal.type === "user"
							? grant.principal.email
							: grant.principal.description || "Group principal"}
					</p>
				</div>
			</div>

			<div className="flex items-center gap-2">
				{canEditRole ? (
					<OptionPicker
						options={ROLES}
						value={grant.role}
						onChange={onChangeRole}
						disabled={disabled}
					/>
				) : (
					<Badge variant="outline" className="capitalize">
						{ROLES.find((role) => role.value === grant.role)?.label}
					</Badge>
				)}
				{isDirect && (
					<Button
						variant="ghost"
						size="icon-sm"
						onClick={onRevoke}
						disabled={disabled}
						className="text-destructive"
					>
						<Trash2Icon className="h-4 w-4" />
						<span className="sr-only">Revoke access</span>
					</Button>
				)}
			</div>
		</div>
	);
};

export { GrantEditorRow };
