import {
	MEMBER_ACCESS_SOURCE,
	type MemberAccessEntry,
	type MemberAccessSource,
	type ResourceType,
} from "@orcai/schema";
import { Link } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { FileIcon, ShieldIcon, SquareStackIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTableColumnHeader } from "@/components/ui/data-table/data-table-column-header";
import type { DataTableFeatures } from "@/components/ui/data-table/data-table-features";
import { blockPaths } from "@/lib/navigation/block-paths";
import { m } from "@/paraglide/messages";
import { getResourceRoleLabel } from "@/settings/display-config";

const roleVariant: Record<
	MemberAccessEntry["role"],
	"outline" | "secondary" | "default"
> = {
	viewer: "outline",
	editor: "secondary",
	manager: "default",
};

const sourceLabel = (source: MemberAccessSource) =>
	({
		[MEMBER_ACCESS_SOURCE.DIRECT_USER]:
			m.members_access_overview_source_direct_user(),
		[MEMBER_ACCESS_SOURCE.DIRECT_GROUP]:
			m.members_access_overview_source_direct_group(),
		[MEMBER_ACCESS_SOURCE.DIRECT_GROUP_ALL_MEMBERS]:
			m.members_access_overview_source_all_members(),
		[MEMBER_ACCESS_SOURCE.INHERITED_ORGANIZATION]:
			m.members_access_overview_source_inherited_organisation(),
		[MEMBER_ACCESS_SOURCE.INHERITED_BOT]:
			m.members_access_overview_source_inherited_bot(),
		[MEMBER_ACCESS_SOURCE.INHERITED_BLOCK]:
			m.members_access_overview_source_inherited_block(),
		[MEMBER_ACCESS_SOURCE.PUBLIC]: m.members_access_overview_source_public(),
	})[source];

const typeLabel = (type: ResourceType) =>
	({
		bot: m.members_access_overview_type_bot(),
		block: m.members_access_overview_type_block(),
		asset: m.members_access_overview_type_asset(),
	})[type];

const typeIcon = {
	bot: ShieldIcon,
	block: SquareStackIcon,
	asset: FileIcon,
} satisfies Record<ResourceType, unknown>;

export const memberAccessTypeOptions = () =>
	(
		[
			"bot",
			"block",
			"asset",
		] as const
	).map((value) => ({
		value,
		label: typeLabel(value),
	}));

export const memberAccessSourceOptions = () =>
	Object.values(MEMBER_ACCESS_SOURCE).map((value) => ({
		value,
		label: sourceLabel(value),
	}));

const ResourceLink = ({ access }: { access: MemberAccessEntry }) => {
	const className = "truncate font-medium hover:underline";

	switch (access.resourceType) {
		case "bot":
			return (
				<Link
					to="/app/library/bots/$botId"
					params={{
						botId: access.resourceId,
					}}
					className={className}
				>
					{access.resourceName ?? m.members_access_overview_untitled_bot()}
				</Link>
			);
		case "block":
			return (
				<Link
					to={blockPaths(access.blockType).detail}
					params={{
						blockId: access.resourceId,
					}}
					className={className}
				>
					{access.resourceName ?? m.members_access_overview_untitled_block()}
				</Link>
			);
		case "asset":
			return (
				<Link
					to="/app/library/assets/$assetId"
					params={{
						assetId: access.resourceId,
					}}
					className={className}
				>
					{access.resourceName ?? m.members_access_overview_untitled_asset()}
				</Link>
			);
	}
};

const columnHelper = createColumnHelper<DataTableFeatures, MemberAccessEntry>();

export const memberAccessTableColumns = columnHelper.columns([
	columnHelper.accessor("resourceName", {
		size: 360,
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.members_access_overview_resource_column_header()}
			/>
		),
		cell: ({ row }) => (
			<div className="min-w-0">
				<ResourceLink access={row.original} />
			</div>
		),
		meta: {
			label: m.members_access_overview_resource_column_header,
		},
	}),
	columnHelper.accessor("resourceType", {
		size: 140,
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.members_access_overview_type_column_header()}
			/>
		),
		cell: ({ row }) => {
			const Icon = typeIcon[row.original.resourceType];
			return (
				<span className="inline-flex items-center gap-1.5 text-muted-foreground">
					<Icon aria-hidden="true" className="size-3.5" />
					{typeLabel(row.original.resourceType)}
				</span>
			);
		},
		meta: {
			label: m.members_access_overview_type_column_header,
		},
	}),
	columnHelper.accessor("role", {
		size: 120,
		enableSorting: false,
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.members_access_overview_role_column_header()}
			/>
		),
		cell: ({ row }) => (
			<Badge variant={roleVariant[row.original.role]}>
				{getResourceRoleLabel(row.original.role)}
			</Badge>
		),
		meta: {
			label: m.members_access_overview_role_column_header,
		},
	}),
	columnHelper.accessor("source", {
		size: 200,
		header: ({ column }) => (
			<DataTableColumnHeader
				column={column}
				title={m.members_access_overview_source_column_header()}
			/>
		),
		cell: ({ row }) => (
			<Badge variant="outline">{sourceLabel(row.original.source)}</Badge>
		),
		meta: {
			label: m.members_access_overview_source_column_header,
		},
	}),
]);
