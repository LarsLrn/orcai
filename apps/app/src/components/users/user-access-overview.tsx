import { USER_ACCESS_SOURCE, type UserAccessEntry } from "@orcai/schema";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { FileIcon, LinkIcon, ShieldIcon, SquareStackIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { orpc } from "@/lib/orpc/orpc";

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

const sourceLabel: Record<UserAccessEntry["source"], string> = {
	[USER_ACCESS_SOURCE.DIRECT_USER]: "Direct user",
	[USER_ACCESS_SOURCE.DIRECT_GROUP]: "Group",
	[USER_ACCESS_SOURCE.DIRECT_GROUP_ALL_MEMBERS]: "All members",
	[USER_ACCESS_SOURCE.INHERITED_ORGANIZATION]: "Inherited org",
	[USER_ACCESS_SOURCE.INHERITED_BOT]: "Inherited bot",
	[USER_ACCESS_SOURCE.INHERITED_BLOCK]: "Inherited block",
	[USER_ACCESS_SOURCE.PUBLIC]: "Public",
};

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
					{access.resourceName ?? "Untitled bot"}
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
					{access.resourceName ?? "Untitled block"}
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
					{access.resourceName ?? "Untitled content item"}
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
					Bot
				</span>
			);
		case "block":
			return (
				<span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
					<SquareStackIcon className="h-3 w-3" />
					Block
				</span>
			);
		case "asset":
			return (
				<span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
					<FileIcon className="h-3 w-3" />
					Content item
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
				<CardTitle>Effective Resource Access</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				{access.data?.data.length ? (
					access.data.data.map((item) => (
						<div
							key={`${item.resourceType}:${item.resourceId}:${item.source}`}
							className="flex items-center justify-between rounded-lg border p-3"
						>
							<div className="space-y-1">
								<ResourceLink access={item} />
								<div className="flex items-center gap-2">
									<ResourceTypeLabel type={item.resourceType} />
									<Badge variant="outline" className="gap-1 text-[10px]">
										<LinkIcon className="h-2.5 w-2.5" />
										{sourceLabel[item.source]}
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
						No effective resource access entries in this organisation.
					</p>
				)}
			</CardContent>
		</Card>
	);
};

export { UserAccessOverview };
