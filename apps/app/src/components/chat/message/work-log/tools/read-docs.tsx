import type { ToolStatus } from "@/lib/ai/turn-view/turn-view";
import type { ReadDocsToolPart } from "@/lib/ai/types/tools";
import { m } from "@/paraglide/messages";
import { ToolEntry } from "../tool-entry";

// Stands in for the title so the message can be split around a link.
const TITLE_SLOT = "\u0000";

const PageLabel = ({ title, url }: { title: string; url: string }) => {
	const [before, after] = m
		.chat_work_log_tool_read_docs_page({
			title: TITLE_SLOT,
		})
		.split(TITLE_SLOT);

	return (
		<>
			{before}
			<a
				href={url}
				target="_blank"
				rel="noreferrer"
				className="underline underline-offset-2 hover:text-primary"
			>
				{title}
			</a>
			{after}
		</>
	);
};

const label = (output: ReadDocsToolPart["output"]) => {
	if (!output) {
		return m.chat_work_log_tool_read_docs_active();
	}

	return output.path ? (
		<PageLabel title={output.title ?? output.path} url={output.url} />
	) : (
		m.chat_work_log_tool_read_docs_index()
	);
};

export const ReadDocs = ({
	part,
	status,
}: {
	part: ReadDocsToolPart;
	status: ToolStatus | null;
}) => <ToolEntry part={part} status={status} label={label(part.output)} />;
