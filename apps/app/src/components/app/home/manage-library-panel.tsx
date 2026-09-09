import { useSuspenseQueries } from "@tanstack/react-query";
import type { LinkProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { buttonVariants } from "@/components/ui/button";
import {
	Panel,
	PanelHeader,
	PanelRows,
	PanelTitle,
	panelRowVariants,
} from "@/components/ui/composed/panel";
import { orpc } from "@/lib/orpc/orpc";
import { formatCount, formatCountOf } from "@/lib/presentation/format-count";

const COUNT_INPUT = {
	pageIndex: 0,
	pageSize: 1,
} as const;

const ManageLibraryPanel = () => {
	const [
		publishedBots,
		draftBots,
		templates,
		imageGeneration,
		repositories,
		assets,
	] = useSuspenseQueries({
		queries: [
			orpc.bot.list.queryOptions({
				input: COUNT_INPUT,
			}),
			orpc.bot.listDrafts.queryOptions({
				input: COUNT_INPUT,
			}),
			orpc.block.list.queryOptions({
				input: {
					...COUNT_INPUT,
					filters: {
						type: "template",
					},
				},
			}),
			orpc.block.list.queryOptions({
				input: {
					...COUNT_INPUT,
					filters: {
						type: "imageGeneration",
					},
				},
			}),
			orpc.block.list.queryOptions({
				input: {
					...COUNT_INPUT,
					filters: {
						type: "database",
					},
				},
			}),
			orpc.asset.list.queryOptions({
				input: COUNT_INPUT,
			}),
		],
	});

	const publishedCount = publishedBots.data.rowCount;
	const draftCount = draftBots.data.rowCount;

	const rows: Array<{
		label: string;
		meta: string;
		count: number;
		linkProps: LinkProps;
	}> = [
		{
			label: "Bots",
			meta: `${formatCount(publishedCount)} published, ${formatCountOf(draftCount, "draft", "drafts")}`,
			count: publishedCount + draftCount,
			linkProps: {
				to: "/app/hub/bots",
			},
		},
		{
			label: "Behaviour blocks",
			meta: "Prompts and image generation",
			count: templates.data.rowCount + imageGeneration.data.rowCount,
			linkProps: {
				to: "/app/hub/behaviour",
			},
		},
		{
			label: "Repositories",
			meta: "Retrieval databases that ground answers",
			count: repositories.data.rowCount,
			linkProps: {
				to: "/app/hub/repositories",
			},
		},
		{
			label: "Assets",
			meta: "Source material for retrieval and citations",
			count: assets.data.rowCount,
			linkProps: {
				to: "/app/hub/assets",
			},
		},
	];

	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>Library</PanelTitle>
				<Link
					to="/app/hub/assets/add"
					className={buttonVariants({
						variant: "ghost",
						size: "sm",
					})}
				>
					Add an asset
				</Link>
			</PanelHeader>
			<PanelRows>
				{rows.map((row) => (
					<Link
						key={row.label}
						{...row.linkProps}
						className={panelRowVariants({
							variant: "link",
						})}
					>
						<div className="flex min-w-0 flex-col gap-1">
							<span className="truncate font-medium">{row.label}</span>
							<p className="truncate text-muted-foreground text-xs">
								{row.meta}
							</p>
						</div>
						<span className="shrink-0 font-medium text-base tabular-nums">
							{formatCount(row.count)}
						</span>
					</Link>
				))}
			</PanelRows>
		</Panel>
	);
};

export { ManageLibraryPanel };
