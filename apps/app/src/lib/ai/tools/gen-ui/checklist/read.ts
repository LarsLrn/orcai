import type { Status } from "@/lib/ai/tools/gen-ui/status";
import {
	isRecord,
	listOf,
	statusOf,
	textOf,
} from "@/lib/ai/tools/gen-ui/streamed";

export type ChecklistItem = {
	label?: string;
	status?: Status;
	summary?: string;
	body?: string;
	quote?: string;
};

const itemOf = (value: unknown): ChecklistItem[] =>
	isRecord(value)
		? [
				{
					label: textOf(value.label),
					status: statusOf(value.status),
					summary: textOf(value.summary),
					body: textOf(value.body),
					quote: textOf(value.quote),
				},
			]
		: [];

/** Partial or stored input, with malformed entries left out. */
export const readChecklist = (input: unknown) => {
	const checklist = isRecord(input) ? input : {};
	return {
		title: textOf(checklist.title),
		description: textOf(checklist.description),
		items: listOf(checklist.items).flatMap(itemOf),
	};
};

export type ChecklistView = ReturnType<typeof readChecklist>;
