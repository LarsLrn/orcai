import type {
	PipelineStatus,
	PublicationStatus,
	RecentResource,
} from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { DisplayDate } from "@/components/ui/composed/display-time";
import {
	Panel,
	PanelHeader,
	PanelNote,
	PanelRows,
	PanelTitle,
	panelRowVariants,
} from "@/components/ui/composed/panel";
import { StateBadge } from "@/components/ui/composed/state-badge";
import { processingStatusBadge } from "@/lib/labels/processing-status";
import { publicationStatusBadge } from "@/lib/labels/publication-status";
import { RESOURCE_KINDS } from "@/lib/labels/resource-kind";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

const RECENT_LIMIT = 6;

const PublicationBadge = ({ status }: { status: PublicationStatus }) => (
	<StateBadge badge={publicationStatusBadge(status)} />
);

const ProcessingBadge = ({ status }: { status: PipelineStatus }) =>
	status === "completed" ? null : (
		<StateBadge badge={processingStatusBadge(status)} />
	);

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
			<p className="text-muted-foreground truncate text-xs">{kind}</p>
		</div>
		<span className="text-muted-foreground shrink-0 text-xs tabular-nums">
			<DisplayDate value={changedAt} />
		</span>
	</>
);

const RecentRow = ({ entry }: { entry: RecentResource }) => {
	switch (entry.resourceType) {
		case "bot":
			return (
				<Link
					to="/app/library/bots/$botId"
					params={{
						botId: entry.resourceId,
					}}
					className={panelRowVariants({
						variant: "link",
					})}
				>
					<RecentRowBody
						kind={RESOURCE_KINDS.bot.label()}
						name={entry.name}
						changedAt={entry.changedAt}
						badge={<PublicationBadge status={entry.status} />}
					/>
				</Link>
			);
		case "block":
			return (
				<Link
					to="/app/library/$kind/$blockId"
					params={{
						kind: entry.blockType,
						blockId: entry.resourceId,
					}}
					className={panelRowVariants({
						variant: "link",
					})}
				>
					<RecentRowBody
						kind={RESOURCE_KINDS[entry.blockType].label()}
						name={entry.name}
						changedAt={entry.changedAt}
						badge={<PublicationBadge status={entry.status} />}
					/>
				</Link>
			);
		case "asset":
			return (
				<Link
					to="/app/library/assets/$assetId"
					params={{
						assetId: entry.resourceId,
					}}
					className={panelRowVariants({
						variant: "link",
					})}
				>
					<RecentRowBody
						kind={RESOURCE_KINDS.asset.label()}
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
					to="/app/library"
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
