import type { ModelId, ProviderId } from "@orcai/core";
import { skipToken, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuotaStatus } from "@/components/quota/use-quota-status";
import { Button, buttonVariants } from "@/components/ui/button";
import {
	Drawer,
	DrawerContent,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@/components/ui/drawer";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { useOrganizationCapabilities } from "@/hooks/authz/use-capabilities";
import { useIsMobile } from "@/hooks/use-mobile";
import { hasCapability } from "@/lib/authz/capabilities";
import { orpc } from "@/lib/orpc/orpc";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { UsageBody } from "./usage-body";
import { UsageRing } from "./usage-ring";
import { usageView } from "./usage-view";

/** The composer's ring for context fill and the selected model's pool, opening their details. */
const UsageIndicator = ({
	providerId,
	modelId,
	contextTokens,
}: {
	providerId: ProviderId | null | undefined;
	modelId: ModelId | null | undefined;
	/** What the newest reply's context held. */
	contextTokens?: number;
}) => {
	const isMobile = useIsMobile();
	const [open, setOpen] = useState(false);
	const quota = useQuotaStatus({
		providerId,
		modelId,
	});
	const { data: model } = useQuery(
		orpc.model.find.queryOptions({
			input: modelId
				? {
						id: modelId,
					}
				: skipToken,
		}),
	);
	const { data: capabilities } = useOrganizationCapabilities([
		"manage_quotas",
	]);

	const view = usageView({
		contextTokens,
		contextWindow: model?.data.contextWindow,
		modelName: model?.data.name,
		pool: quota.data?.data.pool,
	});
	if (!view) return null;

	const handleOpenChange = (next: boolean) => {
		setOpen(next);
		if (next && providerId && modelId) void quota.refetch();
	};

	const trigger = (
		<Button
			type="button"
			variant="ghost"
			size="icon-sm"
			aria-label={m.chat_usage_trigger_aria_label()}
			className={cn(
				"shrink-0 text-muted-foreground",
				view.tone === "warning" && "text-status-warning",
				view.tone === "danger" && "text-status-danger",
			)}
		>
			<UsageRing
				share={view.context?.share ?? 0}
				emphasised={view.tone !== undefined}
			/>
		</Button>
	);
	const body = (
		<UsageBody
			view={view}
			managePool={
				view.pool &&
				hasCapability(capabilities?.data.capabilities, "manage_quotas") ? (
					<Link
						to="/app/quotas/$quotaPoolId"
						params={{
							quotaPoolId: view.pool.id,
						}}
						className={buttonVariants({
							variant: "outline",
							size: "sm",
							className: "mt-1 w-fit",
						})}
					>
						{m.chat_usage_manage_pool_action()}
					</Link>
				) : undefined
			}
		/>
	);

	if (isMobile) {
		return (
			<Drawer open={open} onOpenChange={handleOpenChange}>
				<DrawerTrigger render={trigger} />
				<DrawerContent>
					<DrawerHeader>
						<DrawerTitle className="text-start">
							{m.chat_usage_title()}
						</DrawerTitle>
					</DrawerHeader>
					<div className="p-4">{body}</div>
				</DrawerContent>
			</Drawer>
		);
	}

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger render={trigger} />
			<PopoverContent align="end" side="top" aria-label={m.chat_usage_title()}>
				{body}
			</PopoverContent>
		</Popover>
	);
};

export { UsageIndicator };
