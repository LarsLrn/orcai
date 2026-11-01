import type { BotId, ModelId } from "@orcai/core";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CircleCheckIcon, CircleDashedIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { hasCapability } from "@/lib/authz/capabilities";
import { orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";

/**
 * Who the bot is shared with in the active organisation, each covered by a
 * quota pool for the model or not. It warns; saving goes ahead either way.
 */
const BotSetupCoverage = ({
	botId,
	modelId,
}: {
	botId: BotId;
	modelId: ModelId;
}) => {
	const { data: coverage } = useQuery(
		orpc.botSetup.coverage.queryOptions({
			input: {
				botId,
				modelId,
			},
		}),
	);
	const { data: capabilities } = useOrganizationCapabilities([
		"manage_quotas",
	]);
	const canManageQuotaPools = hasCapability(
		capabilities?.data.capabilities,
		"manage_quotas",
	);

	if (!coverage) {
		return null;
	}
	const { principals } = coverage.data;
	const covered = principals.filter((entry) => entry.covered).length;

	return (
		<section className="flex flex-col gap-3" aria-labelledby="bot-coverage">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h3 id="bot-coverage" className="font-medium text-sm">
					{m.bot_setup_coverage_title()}
				</h3>
				{principals.length > 0 && (
					<span className="text-muted-foreground text-sm tabular-nums">
						{m.bot_setup_coverage_count({
							covered,
							total: principals.length,
						})}
					</span>
				)}
			</div>
			{principals.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					{m.bot_setup_coverage_unshared()}
				</p>
			) : (
				<ul className="flex flex-col gap-1.5">
					{principals.map(({ principal, covered }) => (
						<li
							key={`${principal.type}:${principal.id}`}
							className="flex items-center justify-between gap-3 text-sm"
						>
							<span className="min-w-0 truncate">
								{principal.name}
								{principal.type === "user" && principal.email && (
									<span className="text-muted-foreground">
										{" "}
										{principal.email}
									</span>
								)}
							</span>
							<span
								className={
									covered
										? "inline-flex shrink-0 items-center gap-1 text-foreground"
										: "inline-flex shrink-0 items-center gap-1 text-muted-foreground"
								}
							>
								{covered ? (
									<CircleCheckIcon aria-hidden className="size-4" />
								) : (
									<CircleDashedIcon aria-hidden className="size-4" />
								)}
								{covered
									? m.bot_setup_coverage_covered()
									: m.bot_setup_coverage_not_covered()}
							</span>
						</li>
					))}
				</ul>
			)}
			{covered < principals.length && (
				<p className="text-muted-foreground text-sm">
					{m.bot_setup_coverage_warning()}
				</p>
			)}
			{canManageQuotaPools && covered < principals.length && (
				<Link
					to="/app/quota-pools"
					className={buttonVariants({
						variant: "outline",
						size: "sm",
						className: "self-start",
					})}
				>
					{m.bot_setup_coverage_quota_pools_action()}
				</Link>
			)}
		</section>
	);
};

export { BotSetupCoverage };
