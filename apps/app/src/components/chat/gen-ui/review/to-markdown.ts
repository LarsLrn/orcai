import { indent } from "@/components/chat/gen-ui/markdown";
import {
	itemStatus,
	type ReviewView,
	type StreamedFinding,
	type StreamedItem,
	severityLabel,
} from "@/components/chat/gen-ui/review/findings";
import { statusLabel } from "@/components/chat/gen-ui/status";
import { m } from "@/paraglide/messages";

const listItem = (text: string) =>
	text
		.split("\n")
		.map((line, index) =>
			index === 0 ? `- ${line}` : line === "" ? line : `  ${line}`,
		)
		.join("\n");

const findingToMarkdown = (finding: StreamedFinding) => {
	const { severity } = finding;
	const head = [
		finding.label ? `**${finding.label}**` : undefined,
		severity ? `(${severityLabel(severity)})` : undefined,
	]
		.filter(Boolean)
		.join(" ");
	const body = [
		finding.note,
		finding.excerpt ? `("${finding.excerpt}")` : undefined,
	]
		.filter(Boolean)
		.join(" ");
	const line = body ? (head ? `${head}: ${body}` : body) : head;
	return line ? listItem(line) : undefined;
};

const findingsToMarkdown = (findings: readonly StreamedFinding[] | undefined) =>
	(findings ?? []).flatMap((finding) => findingToMarkdown(finding) ?? []);

const itemToMarkdown = (item: StreamedItem) => {
	const status = itemStatus(item.findings);
	const head = [
		item.label ? `**${item.label}**` : undefined,
		status ? `(${statusLabel(status)})` : undefined,
	]
		.filter(Boolean)
		.join(" ");
	const findings = findingsToMarkdown(item.findings);
	return [
		head,
		item.text ? indent(item.text, "> ") : undefined,
		findings.length > 0 ? findings.join("\n") : undefined,
		item.revised
			? `**${m.gen_ui_review_view_revised()}:** ${item.revised}`
			: undefined,
	]
		.filter(Boolean)
		.join("\n\n");
};

export const reviewToMarkdown = ({
	title,
	summary,
	items,
	general,
}: ReviewView): string => {
	const overall = findingsToMarkdown(general);
	return [
		title ? `### ${title}` : undefined,
		summary,
		...items.map(itemToMarkdown),
		overall.length > 0
			? `**${m.gen_ui_review_overall()}**\n\n${overall.join("\n")}`
			: undefined,
	]
		.filter(Boolean)
		.join("\n\n");
};
