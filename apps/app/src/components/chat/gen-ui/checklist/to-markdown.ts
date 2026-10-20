import type { DeepPartial } from "ai";
import type { ChecklistInput } from "@/components/chat/gen-ui/checklist/schema";
import { indent } from "@/components/chat/gen-ui/markdown";
import { statusLabel, statusSchema } from "@/components/chat/gen-ui/status";

type ChecklistItem = NonNullable<
	NonNullable<DeepPartial<ChecklistInput>["items"]>[number]
>;

const itemToMarkdown = (item: ChecklistItem) => {
	const status = statusSchema.safeParse(item.status);
	const head = [
		item.label ? `**${item.label}**` : undefined,
		status.success ? `(${statusLabel(status.data)})` : undefined,
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

export const checklistToMarkdown = (
	input: DeepPartial<ChecklistInput>,
): string => {
	const items = (input.items ?? []).flatMap((item) => {
		const markdown = item ? itemToMarkdown(item) : undefined;
		return markdown
			? [
					markdown,
				]
			: [];
	});
	return [
		input.title ? `### ${input.title}` : undefined,
		input.description,
		items.join(items.some((item) => item.includes("\n")) ? "\n\n" : "\n"),
	]
		.filter(Boolean)
		.join("\n\n");
};
