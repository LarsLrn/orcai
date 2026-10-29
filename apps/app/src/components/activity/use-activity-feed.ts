import type { ActivityRun } from "@orcai/schema";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { client, orpc } from "@/lib/orpc/orpc";
import { m } from "@/paraglide/messages";
import { activityFeed, ENDED_BATCH } from "./activity-feed";
import { openActivity } from "./activity-state";

/**
 * Keeps the Activity lists in step with the polled summary and toasts what
 * ended. Follows every fetch, also one that returned the same summary, so
 * ended runs whose fetch failed are tried again.
 */
export const useActivityFeed = ({
	data: summary,
	dataUpdatedAt,
}: {
	data: Parameters<ReturnType<typeof activityFeed>>[0] | undefined;
	dataUpdatedAt: number;
}) => {
	const queryClient = useQueryClient();
	// A run that ends after the header unmounted, as on sign-out, shows no toast.
	const mounted = useRef(false);
	const [observe] = useState(() =>
		activityFeed({
			ended: async (runIds: ActivityRun["id"][]) =>
				(
					await client.activity.runs({
						ids: runIds,
						limit: ENDED_BATCH,
					})
				).data,
			toast: ({ runId, tone, title, description }) => {
				if (!mounted.current) return;
				toast[tone](title, {
					id: `activity-${runId}`,
					description: description || undefined,
					action: {
						label: m.activity_toast_show(),
						onClick: openActivity,
					},
				});
			},
			refresh: () => {
				for (const queryKey of [
					orpc.activity.runs.key(),
					orpc.activity.attention.key(),
					orpc.activity.runMembers.key(),
				]) {
					void queryClient.invalidateQueries({
						queryKey,
					});
				}
			},
		}),
	);

	useEffect(() => {
		mounted.current = true;
		return () => {
			mounted.current = false;
		};
	}, []);

	// biome-ignore lint/correctness/useExhaustiveDependencies: a fetch that returned the same summary still counts.
	useEffect(() => {
		if (summary) void observe(summary).catch(() => undefined);
	}, [
		summary,
		dataUpdatedAt,
		observe,
	]);
};
