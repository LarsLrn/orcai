import { USER_ACCESS_SOURCE, type UserAccessEntry } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { FileIcon, LinkIcon, ShieldIcon, SquareStackIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

type UserAccessOverviewProps = {
	userId: string;
};

const roleVariant: Record<
	UserAccessEntry["role"],
	"outline" | "secondary" | "default"
> = {
	viewer: "outline",
	editor: "secondary",
	manager: "default",
};

const sourceLabel = (source: UserAccessEntry["source"]) =>
	({
		[USER_ACCESS_SOURCE.DIRECT_USER]:
			m.users_access_overview_source_direct_user(),
		[USER_ACCESS_SOURCE.DIRECT_GROUP]:
			m.users_access_overview_source_direct_group(),
		[USER_ACCESS_SOURCE.DIRECT_GROUP_ALL_MEMBERS]:
			m.users_access_overview_source_all_members(),
		[USER_ACCESS_SOURCE.INHERITED_ORGANIZATION]:
			m.users_access_overview_source_inherited_organisation(),
		[USER_ACCESS_SOURCE.INHERITED_BOT]:
			m.users_access_overview_source_inherited_bot(),
		[USER_ACCESS_SOURCE.INHERITED_BLOCK]:
			m.users_access_overview_source_inherited_block(),
		[USER_ACCESS_SOURCE.PUBLIC]: m.users_access_overview_source_public(),
	})[source];

const ResourceLink = ({ access }: { access: UserAccessEntry }) => {
	switch (access.resourceType) {
		case "bot":
			return (
				<Link
					to="/app/hub/bots/$botId"
					params={{
						botId: access.resourceId,
					}}
					className="text-primary hover:underline"
				>
					{access.resourceName ?? m.users_access_overview_untitled_bot()}
				</Link>
			);
		case "block":
			return (
				<Link
					to="/app/hub/blocks/$blockId"
					params={{
						blockId: access.resourceId,
					}}
					className="text-primary hover:underline"
				>
					{access.resourceName ?? m.users_access_overview_untitled_block()}
				</Link>
			);
		case "asset":
			return (
				<Link
					to="/app/hub/assets/$assetId"
					params={{
						assetId: access.resourceId,
					}}
					className="text-primary hover:underline"
				>
					{access.resourceName ?? m.users_access_overview_untitled_asset()}
				</Link>
			);
		default:
			return null;
	}
};

const ResourceTypeLabel = ({
	type,
}: {
	type: UserAccessEntry["resourceType"];
}) => {
	switch (type) {
		case "bot":
			return (
				<span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
					<ShieldIcon className="h-3 w-3" />
					{m.users_access_overview_type_bot()}
				</span>
			);
		case "block":
			return (
				<span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
					<SquareStackIcon className="h-3 w-3" />
					{m.users_access_overview_type_block()}
				</span>
			);
		case "asset":
			return (
				<span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
					<FileIcon className="h-3 w-3" />
					{m.users_access_overview_type_asset()}
				</span>
			);
		default:
			return null;
	}
};

const UserAccessOverview = ({ userId }: UserAccessOverviewProps) => {
	const access = useQuery(
		orpc.user.listAccess.queryOptions({
			input: {
				id: userId,
			},
		}),
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>{m.users_access_overview_title()}</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{access.data?.data.length ? (
					access.data.data.map((item) => (
						<div
							key={`${item.resourceType}:${item.resourceId}:${item.source}`}
							className="flex items-center justify-between rounded-xl border p-3"
						>
							<div className="space-y-1">
								<ResourceLink access={item} />
								<div className="flex items-center gap-2">
									<ResourceTypeLabel type={item.resourceType} />
									<Badge variant="outline" className="gap-1">
										<LinkIcon className="h-2.5 w-2.5" />
										{sourceLabel(item.source)}
									</Badge>
								</div>
							</div>
							<Badge variant={roleVariant[item.role]} className="capitalize">
								{item.role}
							</Badge>
						</div>
					))
				) : (
					<p className="text-muted-foreground text-sm">
						{m.users_access_overview_empty_state_description()}
					</p>
				)}
			</CardContent>
		</Card>
	);
};

export { UserAccessOverview };
