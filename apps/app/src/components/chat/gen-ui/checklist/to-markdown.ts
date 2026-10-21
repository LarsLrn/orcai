import type {
	ChecklistItem,
	ChecklistView,
} from "@/components/chat/gen-ui/checklist/read";
import { indent } from "@/components/chat/gen-ui/markdown";
import { statusLabel } from "@/components/chat/gen-ui/status";

const itemToMarkdown = (item: ChecklistItem) => {
	const head = [
		item.label ? `**${item.label}**` : undefined,
		item.status ? `(${statusLabel(item.status)})` : undefined,
	]
		.filter(Boolean)
		.join(" ");
	const line = item.summary
		? head
			? `${head}: ${item.summary}`
			: item.summary
		: head;
	const blocks = [
		item.quote ? indent(item.quote, "  > ") : undefined,
		item.body ? indent(item.body, "  ") : undefined,
	].filter(Boolean);
	if (!line && blocks.length === 0) {
		return undefined;
	}
	return [
		`- ${line}`,
		...blocks,
	].join("\n\n");
};

export const checklistToMarkdown = ({
	title,
	description,
	items,
}: ChecklistView): string => {
	const lines = items.flatMap((item) => itemToMarkdown(item) ?? []);
	return [
		title ? `### ${title}` : undefined,
		description,
		lines.join(lines.some((line) => line.includes("\n")) ? "\n\n" : "\n"),
	]
		.filter(Boolean)
		.join("\n\n");
};
