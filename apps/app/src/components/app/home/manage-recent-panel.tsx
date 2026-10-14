import type {
	ProcessingStatus,
	PublicationStatus,
	RecentResource,
} from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
	Panel,
	PanelHeader,
	PanelNote,
	PanelRows,
	PanelTitle,
	panelRowVariants,
} from "@/components/ui/composed/panel";
import { orpc } from "@/lib/orpc/orpc";
import { formatDisplayDate } from "@/lib/presentation/format-timestamp";
import { getProcessingStatusLabel } from "@/lib/presentation/processing-status";
import { m } from "@/paraglide/messages";

const RECENT_LIMIT = 6;

const PublicationBadge = ({ status }: { status: PublicationStatus }) =>
	status === "ready" ? (
		<Badge variant="success">{m.home_recent_published_badge()}</Badge>
	) : (
		<Badge variant="outline">{m.home_recent_draft_badge()}</Badge>
	);

const ProcessingBadge = ({ status }: { status: ProcessingStatus }) => {
	if (status === "completed") {
		return null;
	}

	return (
		<Badge variant={status === "failed" ? "danger" : "outline"}>
			{getProcessingStatusLabel(status)}
		</Badge>
	);
};

const RecentRowBody = ({
	kind,
	name,
	changedAt,
	badge,
}: {
	kind: string;
	name: string;
	changedAt: Date;
	badge: ReactNode;
}) => (
	<>
		<div className="flex min-w-0 flex-col gap-1">
			<div className="flex items-center gap-2">
				<span className="truncate font-medium">{name}</span>
				{badge}
			</div>
			<p className="truncate text-muted-foreground text-xs">{kind}</p>
		</div>
		<span className="shrink-0 text-muted-foreground text-xs tabular-nums">
			{formatDisplayDate(changedAt)}
		</span>
	</>
);

const RecentRow = ({ entry }: { entry: RecentResource }) => {
	switch (entry.resourceType) {
		case "bot":
			return (
				<Link
					to="/app/hub/bots/$botId"
					params={{
						botId: entry.resourceId,
					}}
					className={panelRowVariants({
						variant: "link",
					})}
				>
					<RecentRowBody
						kind={m.home_recent_bot_kind()}
						name={entry.name}
						changedAt={entry.changedAt}
						badge={<PublicationBadge status={entry.status} />}
					/>
				</Link>
			);
		case "block":
			return (
				<Link
					to="/app/hub/blocks/$blockId"
					params={{
						blockId: entry.resourceId,
					}}
					className={panelRowVariants({
						variant: "link",
					})}
				>
					<RecentRowBody
						kind={
							entry.blockType === "database"
								? m.home_recent_repository_kind()
								: m.home_recent_block_kind()
						}
						name={entry.name}
						changedAt={entry.changedAt}
						badge={<PublicationBadge status={entry.status} />}
					/>
				</Link>
			);
		case "asset":
			return (
				<Link
					to="/app/hub/assets/$assetId"
					params={{
						assetId: entry.resourceId,
					}}
					className={panelRowVariants({
						variant: "link",
					})}
				>
					<RecentRowBody
						kind={m.home_recent_asset_kind()}
						name={entry.name}
						changedAt={entry.changedAt}
						badge={<ProcessingBadge status={entry.processingStatus} />}
					/>
				</Link>
			);
	}
};

/** The bots, blocks, and assets that changed most recently, newest first. */
const ManageRecentPanel = () => {
	const { data: recent } = useSuspenseQuery(
		orpc.resource.listRecent.queryOptions({
			input: {
				limit: RECENT_LIMIT,
			},
		}),
	);

	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>{m.home_recent_panel_title()}</PanelTitle>
				<Link
					to="/app/hub"
					className={buttonVariants({
						variant: "ghost",
						size: "sm",
					})}
				>
					{m.home_recent_panel_open_library_action()}
				</Link>
			</PanelHeader>
			{recent.data.length === 0 ? (
				<PanelNote>{m.home_recent_panel_empty_note()}</PanelNote>
			) : (
				<PanelRows>
					{recent.data.map((entry) => (
						<RecentRow
							key={`${entry.resourceType}:${entry.resourceId}`}
							entry={entry}
						/>
					))}
				</PanelRows>
			)}
		</Panel>
	);
};

export { ManageRecentPanel };
