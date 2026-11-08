import type { RepositoryReadiness } from "@orcai/schema";
import { Link } from "@tanstack/react-router";
import {
	CircleAlertIcon,
	CircleCheckIcon,
	TriangleAlertIcon,
} from "lucide-react";
import { useState } from "react";
import { ComposerPanel } from "@/components/chat/composer-panel";
import { Spinner } from "@/components/ui/spinner";
import { m } from "@/paraglide/messages";
import { assetsPanelView } from "./assets-panel-view";

const RepositoryStatusIcon = ({
	totals,
}: {
	totals: RepositoryReadiness["totals"];
}) => {
	if (totals.preparing > 0) {
		return (
			<Spinner
				aria-label={m.assets_panel_repository_preparing()}
				className="text-muted-foreground size-4 shrink-0"
			/>
		);
	}
	if (totals.failed > 0) {
		return (
			<CircleAlertIcon
				role="img"
				aria-label={m.assets_panel_repository_failed()}
				className="text-status-danger size-4 shrink-0"
			/>
		);
	}
	return (
		<CircleCheckIcon
			role="img"
			aria-label={m.assets_panel_repository_ready()}
			className="text-status-success size-4 shrink-0"
		/>
	);
};

const RepositoryRow = ({ repository }: { repository: RepositoryReadiness }) => {
	const { totals } = repository;

	return (
		<li className="flex items-center gap-2">
			<RepositoryStatusIcon totals={totals} />
			{repository.capabilities.edit ? (
				<Link
					to="/app/library/$kind/$blockId"
					params={{
						kind: "repository",
						blockId: repository.blockId,
					}}
					className="min-w-0 truncate underline-offset-4 hover:underline"
				>
					{repository.name}
				</Link>
			) : (
				<span className="min-w-0 truncate">{repository.name}</span>
			)}
			<span className="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums">
				{m.assets_panel_repository_count({
					ready: totals.ready,
					total: totals.total,
				})}
			</span>
			{totals.failed > 0 && (
				<span className="text-status-danger shrink-0 text-xs tabular-nums">
					{m.assets_panel_repository_failed_count({
						count: totals.failed,
					})}
				</span>
			)}
		</li>
	);
};

/**
 * How far the assets of these repositories are from searchable. Collapsed
 * by default; gone once every asset is ready.
 */
export const AssetsPanelCard = ({
	repositories,
}: {
	repositories: RepositoryReadiness[];
}) => {
	const [open, setOpen] = useState(false);
	const view = assetsPanelView(repositories);

	if (!view) {
		return null;
	}

	const preparing = view.status === "preparing";

	return (
		<ComposerPanel
			label={m.assets_panel_region()}
			icon={
				preparing ? (
					<Spinner className="text-muted-foreground" />
				) : (
					<TriangleAlertIcon
						aria-hidden
						className="text-status-warning size-4 shrink-0"
					/>
				)
			}
			title={
				preparing
					? m.assets_panel_preparing_title()
					: m.assets_panel_failed_title({
							count: view.failed,
						})
			}
			tally={`${view.ready}/${view.total}`}
			open={open}
			onOpenChange={setOpen}
			expandLabel={m.assets_panel_expand()}
			collapseLabel={m.assets_panel_collapse()}
		>
			<ul className="space-y-1.5 px-4 py-2.5">
				{repositories.map((repository) => (
					<RepositoryRow key={repository.blockId} repository={repository} />
				))}
			</ul>
		</ComposerPanel>
	);
};
