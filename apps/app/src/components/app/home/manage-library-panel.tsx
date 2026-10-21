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
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { hasCapability } from "@/lib/authz/capabilities";
import { orpc } from "@/lib/orpc/orpc";
import { formatCount } from "@/lib/presentation/format-number";
import { m } from "@/paraglide/messages";

const COUNT_INPUT = {
	pageIndex: 0,
	pageSize: 1,
} as const;

const ManageLibraryPanel = () => {
	const [publishedBots, draftBots, templates, repositories, assets] =
		useSuspenseQueries({
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
							type: "database",
						},
					},
				}),
				orpc.asset.list.queryOptions({
					input: {
						...COUNT_INPUT,
						filters: {
							origin: "library",
						},
					},
				}),
			],
		});

	const { data: organizationCapabilities } = useOrganizationCapabilities();
	const publishedCount = publishedBots.data.rowCount;
	const draftCount = draftBots.data.rowCount;

	const rows: Array<{
		label: string;
		meta: string;
		count: number;
		linkProps: LinkProps;
	}> = [
		{
			label: m.home_library_bots_label(),
			meta: m.home_library_bots_meta({
				published: formatCount(publishedCount),
				drafts: formatCount(draftCount),
				count: draftCount,
			}),
			count: publishedCount + draftCount,
			linkProps: {
				to: "/app/hub/bots",
			},
		},
		{
			label: m.home_library_blocks_label(),
			meta: m.home_library_blocks_meta(),
			count: templates.data.rowCount,
			linkProps: {
				to: "/app/hub/behaviour",
			},
		},
		{
			label: m.home_library_repositories_label(),
			meta: m.home_library_repositories_meta(),
			count: repositories.data.rowCount,
			linkProps: {
				to: "/app/hub/repositories",
			},
		},
		{
			label: m.home_library_assets_label(),
			meta: m.home_library_assets_meta(),
			count: assets.data.rowCount,
			linkProps: {
				to: "/app/hub/assets",
			},
		},
	];

	return (
		<Panel>
			<PanelHeader>
				<PanelTitle>{m.home_library_panel_title()}</PanelTitle>
				{hasCapability(
					organizationCapabilities?.data.capabilities,
					"create_asset",
				) ? (
					<Link
						to="/app/hub/assets/add"
						className={buttonVariants({
							variant: "ghost",
							size: "sm",
						})}
					>
						{m.home_library_panel_add_asset_action()}
					</Link>
				) : null}
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
