import type { GroupId } from "@orcai/core";
import type { GroupMemberRow } from "@orcai/schema";
import { createColumnHelper } from "@tanstack/react-table";
import { Trash2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { DataTableFeatures } from "@/components/ui/data-table/data-table-features";
import { UserAvatar } from "@/components/users/user-avatar";
import { useRemoveGroupMembersMutation } from "@/hooks/mutations/use-group-mutations";
import { formatDisplayDate } from "@/lib/presentation/format-timestamp";
import { m } from "@/paraglide/messages";

const columnHelper = createColumnHelper<DataTableFeatures, GroupMemberRow>();

const RemoveMemberButton = ({
	groupId,
	member,
}: {
	groupId: GroupId;
	member: GroupMemberRow;
}) => {
	const removeMembers = useRemoveGroupMembersMutation();

	return (
		<Button
			variant="ghost"
			size="icon-sm"
			className="text-destructive"
			disabled={removeMembers.isPending}
			onClick={() =>
				removeMembers.mutate({
					groupId,
					userIds: [
						member.user.id,
					],
				})
			}
		>
			<Trash2Icon />
			<span className="sr-only">{m.groups_member_row_remove_aria_label()}</span>
		</Button>
	);
};

/** Members of one group; explicit members can be removed from it. */
export const groupMemberTableColumns = (groupId: GroupId) =>
	columnHelper.columns([
		columnHelper.accessor((row) => row.user.name, {
			id: "name",
			size: 360,
			header: ({ column }) => (
				<DataTableColumnHeader column={column} title={m.common_name_label()} />
			),
			cell: ({ row }) => (
				<div className="flex min-w-0 items-center gap-3">
					<UserAvatar user={row.original.user} size="sm" />
					<div className="min-w-0">
						<p className="truncate font-medium">{row.original.user.name}</p>
						{row.original.user.email ? (
							<p className="truncate text-muted-foreground text-xs">
								{row.original.user.email}
							</p>
						) : null}
					</div>
				</div>
			),
			meta: {
				label: m.common_name_label,
			},
		}),
		columnHelper.accessor("source", {
			size: 140,
			enableSorting: false,
			header: ({ column }) => (
				<DataTableColumnHeader
					column={column}
					title={m.groups_member_table_source_column_header()}
				/>
			),
			cell: ({ row }) => (
				<Badge variant="outline">
					{row.original.source === "implicit"
						? m.groups_member_row_source_implicit()
						: m.groups_member_row_source_explicit()}
				</Badge>
			),
			meta: {
				label: m.groups_member_table_source_column_header,
			},
		}),
		columnHelper.accessor("addedAt", {
			size: 160,
			enableSorting: false,
			header: ({ column }) => (
				<DataTableColumnHeader
					column={column}
					title={m.groups_member_table_added_column_header()}
				/>
			),
			cell: ({ row }) =>
				row.original.addedAt ? formatDisplayDate(row.original.addedAt) : "—",
			meta: {
				label: m.groups_member_table_added_column_header,
			},
		}),
		columnHelper.display({
			id: "actions",
			size: 32,
			enableSorting: false,
			enableHiding: false,
			cell: ({ row }) =>
				row.original.source === "explicit" ? (
					<RemoveMemberButton groupId={groupId} member={row.original} />
				) : null,
		}),
	]);
