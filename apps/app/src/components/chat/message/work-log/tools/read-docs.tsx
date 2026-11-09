import type { ReadDocsToolPart } from "@/lib/ai/messages/tools";
import type { ToolStatus } from "@/lib/ai/messages/turn-view";
import { readDocsOutputSchema } from "@/lib/ai/tools/docs/outputs";
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
				className="hover:text-primary underline underline-offset-2"
			>
				{title}
			</a>
			{after}
		</>
	);
};

/** The page a call read; the index for one without a path or an output that does not fit. */
const label = (output: unknown) => {
	if (output === undefined) {
		return m.chat_work_log_tool_read_docs_active();
	}

	const page = readDocsOutputSchema.safeParse(output).data;
	return page?.path ? (
		<PageLabel title={page.title ?? page.path} url={page.url} />
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
