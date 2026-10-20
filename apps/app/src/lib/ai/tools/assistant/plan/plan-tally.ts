import { m } from "@/paraglide/messages";
import type { Plan } from "./plan";

type PlanItems = Plan["items"];

export const planCounts = (items: PlanItems) => ({
	done: items.filter((item) => item.status === "done").length,
	skipped: items.filter((item) => item.status === "skipped").length,
	total: items.length,
});

/** “2 of 5 done”, plus the skipped count when there is one. */
export const planTally = (items: PlanItems): string => {
	const { done, skipped, total } = planCounts(items);

	return skipped > 0
		? m.assistant_plan_tally_skipped({
				done,
				total,
				count: skipped,
			})
		: m.assistant_plan_tally({
				done,
				total,
			});
};

export const isPlanFinished = (items: PlanItems) =>
	items.every((item) => item.status === "done" || item.status === "skipped");
