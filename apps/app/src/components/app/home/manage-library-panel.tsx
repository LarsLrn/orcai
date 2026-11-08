import type { LibraryKind } from "@orcai/schema";
import { useSuspenseQuery } from "@tanstack/react-query";
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
import { libraryCountsQuery } from "@/lib/library/library-queries";
import { formatCount } from "@/lib/presentation/format-number";
import { m } from "@/paraglide/messages";

const ManageLibraryPanel = () => {
	const {
		data: { data: counts },
	} = useSuspenseQuery(
		libraryCountsQuery({
			scope: "all",
			query: "",
		}),
	);
	const { data: organizationCapabilities } = useOrganizationCapabilities();
	const published = (kind: LibraryKind) =>
		counts[kind].total - counts[kind].drafts;

	const rows: Array<{
		label: string;
		meta: string;
		count: number;
		linkProps: LinkProps;
	}> = [
		{
			label: m.home_library_bots_label(),
			meta: m.home_library_bots_meta({
				published: formatCount(published("bot")),
				drafts: formatCount(counts.bot.drafts),
				count: counts.bot.drafts,
			}),
			count: counts.bot.total,
			linkProps: {
				to: "/app/library/bots",
			},
		},
		{
			label: m.home_library_blocks_label(),
			meta: m.home_library_blocks_meta(),
			count: published("behaviour"),
			linkProps: {
				to: "/app/library/$kind",
				params: {
					kind: "behaviour",
				},
			},
		},
		{
			label: m.home_library_repositories_label(),
			meta: m.home_library_repositories_meta(),
			count: published("repository"),
			linkProps: {
				to: "/app/library/$kind",
				params: {
					kind: "repository",
				},
			},
		},
		{
			label: m.home_library_assets_label(),
			meta: m.home_library_assets_meta(),
			count: counts.asset.total,
			linkProps: {
				to: "/app/library/assets",
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
						to="/app/library/assets/add"
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
							<p className="text-muted-foreground truncate text-xs">
								{row.meta}
							</p>
						</div>
						<span className="shrink-0 text-base font-medium tabular-nums">
							{formatCount(row.count)}
						</span>
					</Link>
				))}
			</PanelRows>
		</Panel>
	);
};

export { ManageLibraryPanel };
