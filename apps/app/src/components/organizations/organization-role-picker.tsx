import { ORGANIZATION_ROLES, type OrganizationRole } from "@orcai/core";
import { useMemo, useState } from "react";
import {
	DialogSelect,
	DialogSelectContent,
	DialogSelectItem,
	DialogSelectList,
	DialogSelectTrigger,
} from "@/components/ui/composed/dialog-select";
import {
	getOrganizationRoleDescription,
	getOrganizationRoleLabel,
} from "@/lib/authz/organization-role-metadata";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";

const OrganizationRolePicker = ({
	value,
	onValueChange,
	variant = "compact",
	className,
	disabled,
	title = m.orgs_role_picker_title(),
	roles = ORGANIZATION_ROLES,
}: {
	value: OrganizationRole;
	onValueChange: (role: OrganizationRole) => void;
	variant?: "compact" | "full";
	className?: string;
	disabled?: boolean;
	title?: string;
	roles?: readonly OrganizationRole[];
}) => {
	const [open, setOpen] = useState(false);
	const descriptions = useMemo(
		() =>
			new Map(
				ORGANIZATION_ROLES.map((entry) => [
					entry,
					getOrganizationRoleDescription(entry),
				]),
			),
		[],
	);

	return (
		<DialogSelect
			value={value}
			onValueChange={(nextRole) => {
				if (!nextRole || nextRole === value) {
					return;
				}

				onValueChange(nextRole as OrganizationRole);
			}}
			open={open}
			onOpenChange={setOpen}
		>
			<DialogSelectTrigger
				className={cn(
					variant === "compact"
						? "max-w-40 border-transparent bg-transparent px-2 hover:bg-muted"
						: "w-full justify-between",
					className,
				)}
				disabled={disabled}
				placeholder={m.orgs_role_picker_placeholder()}
				size={variant === "compact" ? "sm" : "default"}
			>
				<span className="truncate">{getOrganizationRoleLabel(value)}</span>
			</DialogSelectTrigger>
			<DialogSelectContent title={title}>
				<DialogSelectList>
					{roles.map((entry) => (
						<DialogSelectItem
							key={entry}
							value={entry}
							title={getOrganizationRoleLabel(entry)}
							description={descriptions.get(entry)}
						/>
					))}
				</DialogSelectList>
			</DialogSelectContent>
		</DialogSelect>
	);
};

export { OrganizationRolePicker };
