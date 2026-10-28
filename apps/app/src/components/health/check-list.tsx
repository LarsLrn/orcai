import type { Check, CheckStatus } from "@orcai/schema";
import {
	CircleAlertIcon,
	CircleCheckIcon,
	CircleXIcon,
	type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemMedia,
	ItemTitle,
} from "@/components/ui/item";
import { cn } from "@/lib/utils";
import { m } from "@/paraglide/messages";
import { checkReasonMessage } from "./check-reason";

const statusIcons: Record<
	CheckStatus,
	{
		icon: LucideIcon;
		className: string;
		label: () => string;
	}
> = {
	ok: {
		icon: CircleCheckIcon,
		className: "text-status-success",
		label: m.check_status_ok,
	},
	warning: {
		icon: CircleAlertIcon,
		className: "text-status-warning",
		label: m.check_status_warning,
	},
	failing: {
		icon: CircleXIcon,
		className: "text-status-danger",
		label: m.check_status_failing,
	},
};

/** A list of checks with status, reason, any technical detail and an optional fix. */
export const CheckList = <TCheck extends Check>({
	checks,
	title,
	action,
}: {
	checks: readonly TCheck[];
	title: (check: TCheck) => string;
	/** Where to fix a check that is not ok, in the viewer's own context. */
	action?: (check: TCheck) => ReactNode;
}) => (
	<ItemGroup className="gap-2">
		{checks.map((check) => {
			const status = statusIcons[check.status];
			return (
				<Item
					key={check.id}
					variant="outline"
					size="sm"
					role="listitem"
					aria-label={title(check)}
					data-status={check.status}
				>
					<ItemMedia>
						<status.icon
							role="img"
							aria-label={status.label()}
							className={cn("size-5", status.className)}
						/>
					</ItemMedia>
					<ItemContent className="min-w-0">
						<ItemTitle>
							{title(check)}
							{check.status !== "ok" && (
								<Badge
									variant={check.severity === "required" ? "danger" : "outline"}
								>
									{check.severity === "required"
										? m.check_severity_required()
										: m.check_severity_recommended()}
								</Badge>
							)}
						</ItemTitle>
						<ItemDescription>{checkReasonMessage(check)}</ItemDescription>
						{check.detail && (
							<pre className="mt-1 whitespace-pre-wrap break-words font-mono text-muted-foreground text-xs">
								{check.detail}
							</pre>
						)}
					</ItemContent>
					{check.status !== "ok" && action && (
						<ItemActions>{action(check)}</ItemActions>
					)}
				</Item>
			);
		})}
	</ItemGroup>
);
