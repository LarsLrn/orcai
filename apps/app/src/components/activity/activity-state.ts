import { createAtom } from "@tanstack/react-store";
import { orpc } from "@/lib/orpc/orpc";

/** Whether the header's Activity popover or drawer is open; the dashboard card and toasts open it too. */
export const activityOpen = createAtom(false);

export const openActivity = () => activityOpen.set(true);

/** Polled faster while something runs. Hidden tabs do not poll, and focusing one refetches. */
export const RUNNING_POLL_MS = 3_000;
const IDLE_POLL_MS = 60_000;

/** The one summary query the header, the dashboard card and toasts share. */
export const activitySummaryOptions = () =>
	orpc.activity.summary.queryOptions({
		input: {},
		refetchInterval: (query) =>
			(query.state.data?.running.length ?? 0) > 0
				? RUNNING_POLL_MS
				: IDLE_POLL_MS,
		refetchOnWindowFocus: "always",
	});
