import { useQuery } from "@tanstack/react-query";
import { useAtom } from "@tanstack/react-store";
import { ActivityIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
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
	PopoverTitle,
	PopoverTrigger,
} from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import { activityLabel } from "@/lib/presentation/activity";
import { m } from "@/paraglide/messages";
import { ActivityPanel } from "./activity-panel";
import { activityOpen, activitySummaryOptions } from "./activity-state";
import { useActivityFeed } from "./use-activity-feed";

/** A faint track with a short arc that spins around the trigger. */
const RunningRing = () => (
	<svg
		aria-hidden="true"
		viewBox="0 0 32 32"
		className="absolute inset-0 size-8 animate-spin text-status-processing [animation-duration:1.4s] motion-reduce:animate-none"
	>
		<circle
			cx="16"
			cy="16"
			r="14"
			fill="none"
			stroke="currentColor"
			strokeOpacity="0.2"
			strokeWidth="2"
		/>
		<circle
			cx="16"
			cy="16"
			r="14"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeDasharray="22 66"
		/>
	</svg>
);

/**
 * The header's Activity button: a spinning ring while the user's work runs
 * and a count of what needs them. It opens the list in a popover, or in a
 * drawer below md.
 */
export const ActivityIndicator = () => {
	const isMobile = useIsMobile();
	const [open, setOpen] = useAtom(activityOpen);
	const summaryQuery = useQuery(activitySummaryOptions());
	const summary = summaryQuery.data;
	useActivityFeed(summaryQuery);

	const running = summary?.running ?? [];
	const attention = summary
		? summary.attention.suggestions + summary.attention.failures
		: 0;

	const trigger = (
		<Button
			variant="ghost"
			size="icon-sm"
			className="relative"
			aria-label={activityLabel({
				running: running.length,
				attention,
			})}
		>
			{running.length > 0 ? <RunningRing /> : null}
			<ActivityIcon aria-hidden="true" />
			{attention > 0 ? (
				<span
					aria-hidden="true"
					className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-medium text-[10px] text-primary-foreground tabular-nums ring-2 ring-sidebar"
				>
					{attention > 99 ? "99+" : attention}
				</span>
			) : null}
		</Button>
	);

	if (isMobile) {
		return (
			<Drawer open={open} onOpenChange={setOpen}>
				<DrawerTrigger render={trigger} />
				<DrawerContent className="pb-4">
					<DrawerHeader className="border-b pb-3">
						<DrawerTitle className="text-start font-heading font-semibold">
							{m.activity_title()}
						</DrawerTitle>
					</DrawerHeader>
					<ActivityPanel
						running={running}
						className="max-h-none min-h-0 flex-1"
					/>
				</DrawerContent>
			</Drawer>
		);
	}

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger render={trigger} />
			<PopoverContent
				align="end"
				sideOffset={10}
				positionMethod="fixed"
				className="w-[min(26rem,calc(100vw-1rem))] gap-0 p-0"
			>
				<div className="border-b px-4 py-3">
					<PopoverTitle className="font-heading font-semibold">
						{m.activity_title()}
					</PopoverTitle>
				</div>
				<ActivityPanel running={running} />
			</PopoverContent>
		</Popover>
	);
};
